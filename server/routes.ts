import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertMessageSchema, 
  insertStarSchema, 
  insertReportSchema,
  insertConnectRequestSchema,
  insertVerificationSchema,
  insertTopicSchema,
  insertTopicScheduleSchema,
  insertTopicEngagementSchema,
  insertInviteCodeSchema,
  insertReferralSchema,
  insertInviteAnalyticsSchema,
  type MessageWithAuthor,
  type UserPointHistory,
  type LeaderboardEntry,
  type DistributionEvent,
  type Topic,
  type TopicWithSchedule,
  type DailyTopicInfo,
  type TopicAnalytics,
  type AdminTopicSummary,
  type InviteCodeWithStats,
  type ReferralWithDetails,
  type ReferralDashboard,
  type ReferralLeaderboardEntry,
  type InviteAnalyticsSummary,
  type ReferralSystemStats 
} from "@shared/schema";
import crypto from "crypto";
import { automatedModeration } from "./automated-moderation";
import { contentAnalyzer } from "./content-analyzer";
import { POLICY } from "./config";

// Rate limit constants - using POLICY values for verified users
const RATE_LIMITS = {
  MESSAGES_PER_MIN: POLICY.verifiedPerMin,
  MESSAGES_PER_HOUR: POLICY.verifiedPerHour,
  MESSAGES_PER_DAY: POLICY.verifiedPerDay,
  STARS_PER_MIN: parseInt(process.env.RATE_LIMIT_STARS_PER_MIN || '20'),
  WORK_LINKS_PER_10MIN: parseInt(process.env.RATE_LIMIT_WORK_LINKS_PER_10MIN || '2'),
  WORK_LINKS_PER_HOUR: parseInt(process.env.RATE_LIMIT_WORK_LINKS_PER_HOUR || '4'),
};

// Guest mode configuration - using POLICY values
const GUEST_CONFIG = {
  ENABLED: process.env.FEATURE_GUEST_MODE === 'true' || process.env.NODE_ENV === 'development',
  MAX_CHARS: POLICY.guestCharLimit,
  COOLDOWN_SEC: POLICY.guestCooldownSec,
  MAX_PER_DAY: POLICY.guestDaily,
};

// Simple content filter
const BAD_WORDS = [
  'spam', 'scam', 'crypto', 'buy now', 'click here', 'free money',
  'investment', 'trading', 'profit', 'earn money'
];

// WebSocket clients for real-time updates
const wsClients = new Set<WebSocket>();

interface AuthenticatedRequest extends Request {
  humanId?: string;
  sessionId?: string;
  userRole?: 'guest' | 'verified' | 'admin';
  guestSessionId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    clientTracking: true
  });

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket client connected');
    wsClients.add(ws);

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'auth' && message.humanId) {
          // Update presence when client connects
          await storage.updatePresence(message.humanId);
          
          // Send current online count
          const presence = await storage.getOnlinePresence();
          broadcast({
            type: 'presence_update',
            data: presence
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      wsClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    });
  });

  // Broadcast function for real-time updates
  function broadcast(message: any) {
    const data = JSON.stringify(message);
    wsClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // Admin authentication middleware (basic check for now - in production would use proper admin roles)
  const authenticateAdmin = async (req: AuthenticatedRequest, res: Response, next: any) => {
    const adminKey = req.headers['x-admin-key'] as string;
    
    // Simple admin key check (in production, use proper role-based auth)
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ 
        message: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED'
      });
    }

    // Still need to authenticate the human
    return authenticateHuman(req, res, next);
  };

  // Guest session middleware - creates and tracks guest sessions
  const handleGuestSession = async (req: AuthenticatedRequest, res: Response, next: any) => {
    if (!GUEST_CONFIG.ENABLED) {
      return next();
    }

    // Get guest session ID from cookie
    const cookies = req.headers.cookie || '';
    const cookieObj: { [key: string]: string } = {};
    cookies.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) cookieObj[key] = value;
    });
    
    let guestSessionId = cookieObj.wm_sid;
    
    // Hash IP and user agent for privacy-preserving tracking
    const ipHash = crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex');
    const userAgentHash = crypto.createHash('sha256').update(req.headers['user-agent'] || 'unknown').digest('hex');
    const dayBucket = new Date().toISOString().split('T')[0];
    
    // Find or create guest session
    let guestSession = guestSessionId ? await storage.getGuestSession(guestSessionId) : null;
    
    if (!guestSession) {
      // Try to find existing session by hash
      guestSession = await storage.getGuestSessionByHash(ipHash, userAgentHash);
      
      if (!guestSession) {
        // Create new guest session
        guestSession = await storage.createGuestSession({
          ipHash,
          userAgentHash,
          dayBucket,
          messageCount: 0
        });
      }
      
      // Set cookie with new name and 1 year expiry
      res.setHeader('Set-Cookie', `wm_sid=${guestSession.id}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${365*24*60*60}`);
    } else {
      // Update last seen
      await storage.updateGuestSessionActivity(guestSession.id);
    }
    
    req.guestSessionId = guestSession.id;
    next();
  };

  // Middleware to extract and verify human ID from World ID nullifier
  const authenticateHuman = async (req: AuthenticatedRequest, res: Response, next: any) => {
    const worldIdProof = req.headers['x-world-id-proof'] as string;
    
    // Check if guest mode is enabled and no proof provided
    if (!worldIdProof && GUEST_CONFIG.ENABLED) {
      // Handle as guest
      req.userRole = 'guest';
      return next();
    }
    
    if (!worldIdProof) {
      return res.status(401).json({ 
        message: 'World ID verification required',
        code: 'VERIFICATION_REQUIRED'
      });
    }

    try {
      // In a real implementation, verify the World ID proof here
      // For now, we'll use the proof as a simulated nullifier hash
      const humanId = crypto.createHash('sha256').update(worldIdProof).digest('hex');
      
      // Ensure human exists in storage
      let human = await storage.getHuman(humanId);
      if (!human) {
        human = await storage.createHuman({ id: humanId, role: 'verified' });
      }

      // Update presence
      await storage.updatePresence(humanId);
      
      req.humanId = humanId;
      req.userRole = human.role || 'verified';
      next();
    } catch (error) {
      return res.status(401).json({ 
        message: 'Invalid World ID proof',
        code: 'INVALID_PROOF'
      });
    }
  };

  // Content filter function
  function filterContent(text: string): { isValid: boolean; reason?: string } {
    if (text.length > 240) {
      return { isValid: false, reason: 'Message too long (240 character limit)' };
    }

    if (text.length < 1) {
      return { isValid: false, reason: 'Message cannot be empty' };
    }

    const lowerText = text.toLowerCase();
    for (const word of BAD_WORDS) {
      if (lowerText.includes(word)) {
        return { isValid: false, reason: 'Message contains restricted content' };
      }
    }

    return { isValid: true };
  }

  // Rate limiting helper
  async function checkRateLimit(humanId: string, action: string): Promise<{ allowed: boolean; cooldownSeconds?: number }> {
    const limits = {
      'message_minute': RATE_LIMITS.MESSAGES_PER_MIN,
      'message_hour': RATE_LIMITS.MESSAGES_PER_HOUR,
      'message_day': RATE_LIMITS.MESSAGES_PER_DAY,
      'star_minute': RATE_LIMITS.STARS_PER_MIN,
      'work_link_10min': RATE_LIMITS.WORK_LINKS_PER_10MIN,
      'work_link_hour': RATE_LIMITS.WORK_LINKS_PER_HOUR,
    };

    if (action === 'message') {
      const [perMin, perHour, perDay] = await Promise.all([
        storage.getRateLimit(humanId, 'message', 'minute'),
        storage.getRateLimit(humanId, 'message', 'hour'),
        storage.getRateLimit(humanId, 'message', 'day'),
      ]);

      if (perMin >= RATE_LIMITS.MESSAGES_PER_MIN) {
        return { allowed: false, cooldownSeconds: 60 };
      }
      if (perHour >= RATE_LIMITS.MESSAGES_PER_HOUR) {
        return { allowed: false, cooldownSeconds: 3600 };
      }
      if (perDay >= RATE_LIMITS.MESSAGES_PER_DAY) {
        return { allowed: false, cooldownSeconds: 86400 };
      }
    }

    if (action === 'star') {
      const perMin = await storage.getRateLimit(humanId, 'star', 'minute');
      if (perMin >= RATE_LIMITS.STARS_PER_MIN) {
        return { allowed: false, cooldownSeconds: 60 };
      }
    }

    if (action === 'work_link') {
      const [per10Min, perHour] = await Promise.all([
        storage.getRateLimit(humanId, 'work_link', 'minute'), // Use minute as 10min proxy
        storage.getRateLimit(humanId, 'work_link', 'hour'),
      ]);

      // Rough 10-minute check (not exact, but sufficient for demo)
      if (per10Min >= RATE_LIMITS.WORK_LINKS_PER_10MIN) {
        return { allowed: false, cooldownSeconds: 600 };
      }
      if (perHour >= RATE_LIMITS.WORK_LINKS_PER_HOUR) {
        return { allowed: false, cooldownSeconds: 3600 };
      }
    }

    return { allowed: true };
  }

  // Apply guest session middleware to all routes
  app.use(handleGuestSession);

  // Policy endpoint - returns public policy configuration
  app.get('/api/policy', (req, res) => {
    res.json({
      guestMode: {
        enabled: GUEST_CONFIG.ENABLED,
        maxChars: POLICY.guestCharLimit,
        cooldownSec: POLICY.guestCooldownSec,
        maxPerDay: POLICY.guestDaily
      },
      verified: {
        maxChars: POLICY.verifiedCharLimit,
        features: ['star', 'report', 'work_mode', 'connect']
      },
      rateLimits: {
        messages: {
          perMinute: POLICY.verifiedPerMin,
          perHour: POLICY.verifiedPerHour,
          perDay: POLICY.verifiedPerDay
        },
        stars: {
          perMinute: RATE_LIMITS.STARS_PER_MIN
        },
        workLinks: {
          per10Minutes: RATE_LIMITS.WORK_LINKS_PER_10MIN,
          perHour: RATE_LIMITS.WORK_LINKS_PER_HOUR
        }
      },
      worldId: POLICY.worldId,
      features: {
        enablePermit2: POLICY.enablePermit2,
        disableWorldId: POLICY.disableWorldId
      }
    });
  });

  // World ID verification endpoint
  app.post('/api/verify/worldid', async (req, res) => {
    try {
      // Check if World ID is disabled
      if (POLICY.disableWorldId) {
        return res.status(503).json({
          message: 'World ID verification is temporarily unavailable. Please try again later.',
          code: 'SERVICE_UNAVAILABLE'
        });
      }
      
      const { 
        nullifier_hash,
        proof, 
        merkle_root, 
        verification_level, 
        action, 
        signal 
      } = req.body;
      
      // Validate required fields
      if (!nullifier_hash || !proof || !merkle_root || !verification_level || !action) {
        return res.status(400).json({
          message: 'Missing required verification parameters',
          code: 'INVALID_REQUEST'
        });
      }
      
      // Validate action matches policy
      if (action !== POLICY.worldId.action) {
        return res.status(400).json({
          message: 'Invalid action parameter',
          code: 'INVALID_ACTION'
        });
      }
      
      // Prepare request to World ID Cloud API
      const verificationData: any = {
        nullifier_hash,
        proof,
        merkle_root,
        verification_level,
        action
      };
      
      // If signal is provided, add it to the request
      if (signal) {
        // Note: In production, you might want to use keccak256 for signal hashing
        // For now using SHA-256 for consistency
        const signalHash = crypto.createHash('sha256').update(signal).digest('hex');
        verificationData.signal_hash = signalHash;
      }
      
      // Call World ID Cloud API v2
      const worldIdResponse = await fetch(
        `${POLICY.worldId.apiBase}/api/v2/verify/${POLICY.worldId.appId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(verificationData)
        }
      );
      
      const worldIdResult = await worldIdResponse.json();
      
      if (!worldIdResponse.ok) {
        console.log('[worldid.verify] failure:', worldIdResult);
        return res.status(400).json({
          message: worldIdResult.message || 'World ID verification failed',
          code: 'VERIFICATION_FAILED',
          details: worldIdResult
        });
      }
      
      // Verification successful - compute SHA-256 hash of nullifier
      const nullifierHashHashed = crypto.createHash('sha256').update(nullifier_hash).digest('hex');
      
      // Check if this nullifier has already been verified
      const existingVerification = await storage.getVerificationByNullifierHash(nullifierHashHashed);
      
      if (existingVerification) {
        // User already verified, just return success
        console.log('[worldid.verify] success: already verified');
        
        // Set cookies
        res.setHeader('Set-Cookie', [
          `wm_uid=${existingVerification.userId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${365*24*60*60}`,
          `wm_sid=; HttpOnly; Path=/; Max-Age=0` // Clear guest session
        ].join(', '));
        
        return res.json({
          ok: true,
          role: 'verified',
          humanId: existingVerification.userId
        });
      }
      
      // New verification - create user and verification record
      const userId = crypto.createHash('sha256').update(nullifier_hash + 'user').digest('hex');
      
      // Create or update human
      let human = await storage.getHuman(userId);
      if (!human) {
        human = await storage.createHuman({ id: userId, role: 'verified' });
      } else {
        await storage.updateHumanRole(userId, 'verified');
      }
      
      // Create verification record
      await storage.createVerification({
        userId,
        nullifierHashHashed
      });
      
      console.log('[worldid.verify] success: new verification');
      
      // Set cookies
      res.setHeader('Set-Cookie', [
        `wm_uid=${userId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${365*24*60*60}`,
        `wm_sid=; HttpOnly; Path=/; Max-Age=0` // Clear guest session
      ].join(', '));
      
      return res.json({
        ok: true,
        role: 'verified',
        humanId: userId
      });
      
    } catch (error) {
      console.error('[worldid.verify] error:', error);
      return res.status(500).json({
        message: 'Internal server error during verification',
        code: 'INTERNAL_ERROR'
      });
    }
  });

  // Me endpoint - returns current user info and role
  app.get('/api/me', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    const role = req.userRole || 'guest';
    const humanId = req.humanId;
    
    let human = null;
    if (humanId) {
      human = await storage.getHuman(humanId);
    }
    
    // Get applicable limits based on role
    const limits = role === 'guest' ? {
      maxChars: POLICY.guestCharLimit,
      cooldownSec: POLICY.guestCooldownSec,
      maxPerDay: POLICY.guestDaily,
      features: ['global_room']
    } : {
      maxChars: POLICY.verifiedCharLimit,
      features: ['global_room', 'star', 'report', 'work_mode', 'connect']
    };
    
    res.json({
      humanId: humanId || null,
      role,
      isVerified: role === 'verified' || role === 'admin',
      limits,
      joinedAt: human?.joinedAt || null,
      capsuleSeen: human?.capsuleSeen || false
    });
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Get messages for a room
  app.get('/api/messages/:room', async (req, res) => {
    try {
      const { room } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      if (!['global', 'work'].includes(room)) {
        return res.status(400).json({ message: 'Invalid room' });
      }

      const messages = await storage.getMessages(room, limit);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Send a message (requires authentication)
  app.post('/api/messages', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const userRole = req.userRole || 'guest';
      const messageData = insertMessageSchema.parse(req.body);
      
      // Guest mode restrictions
      if (userRole === 'guest') {
        // Check if guest mode is enabled
        if (!GUEST_CONFIG.ENABLED) {
          return res.status(403).json({
            message: 'Guest mode is disabled. Please verify with World ID.',
            code: 'VERIFICATION_REQUIRED'
          });
        }
        
        // Restrict to global room only
        if (messageData.room !== 'global') {
          return res.status(403).json({
            message: 'Guests can only post in the global room',
            code: 'VERIFICATION_REQUIRED'
          });
        }
        
        // Enforce character limit
        if (messageData.text.length > POLICY.guestCharLimit) {
          console.log(`[post] role=guest blocked reason=char_limit_exceeded length=${messageData.text.length}`);
          return res.status(403).json({
            message: `Guest limit is ${POLICY.guestCharLimit} characters. Verify to unlock full chat.`,
            code: 'GUEST_LIMIT_EXCEEDED'
          });
        }
        
        // Check guest rate limits
        const dayBucket = new Date().toISOString().split('T')[0];
        const messageCount = await storage.getGuestMessageCount(req.guestSessionId!, dayBucket);
        
        if (messageCount >= POLICY.guestDaily) {
          console.log(`[post] role=guest blocked reason=daily_limit_exceeded count=${messageCount}`);
          return res.status(429).json({
            message: `Guests limited to ${POLICY.guestDaily} messages per day. Verify to unlock full chat!`,
            code: 'GUEST_RATE_LIMITED'
          });
        }
        
        // Create a temporary human ID for guests
        const humanId = `guest_${req.guestSessionId}`;
        
        // Ensure guest user exists in humans table
        let guestHuman = await storage.getHuman(humanId);
        if (!guestHuman) {
          await storage.createHuman({
            id: humanId,
            role: 'guest'
          });
        }
        
        // Create message for guest
        const message = await storage.createMessage({
          ...messageData,
          authorHumanId: humanId,
          authorRole: 'guest'
        });
        
        // Update guest session message count
        await storage.incrementGuestMessageCount(req.guestSessionId!, dayBucket);
        
        // Broadcast new message
        broadcast({
          type: 'new_message',
          data: {
            ...message,
            authorHandle: `Guest`,
            isStarredByUser: false
          }
        });
        
        console.log(`[post] role=guest accepted messageId=${message.id}`);
        return res.json({ message, code: 'SUCCESS' });
      }
      
      // Verified user flow continues below
      const humanId = req.humanId!;

      // Check user moderation status first
      const moderationStatus = await automatedModeration.checkUserModerationStatus(humanId);
      
      if (moderationStatus.isBanned) {
        return res.status(403).json({ 
          message: 'Account suspended',
          code: 'ACCOUNT_SUSPENDED'
        });
      }

      // Rate limiting (enhanced with moderation status)
      const rateLimitAction = messageData.link ? 'work_link' : 'message';
      const rateCheck = await checkRateLimit(humanId, rateLimitAction);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: `You're sending messages fast. Take a breath—back in ${rateCheck.cooldownSeconds} sec.`,
          code: 'RATE_LIMITED',
          cooldownSeconds: rateCheck.cooldownSeconds
        });
      }

      // Advanced content moderation
      const userTrust = await storage.getUserTrustScore(humanId);
      const isFirstMessage = !userTrust || userTrust.totalMessages === 0;
      
      const moderationDecision = await automatedModeration.moderateContent(
        'temp_' + Date.now(), // Temporary ID for pre-screening
        messageData.text,
        humanId,
        {
          room: messageData.room,
          isFirstMessage,
          hasUrls: !!messageData.link,
          language: req.headers['accept-language']?.split(',')[0] || 'en'
        }
      );

      // Handle moderation decision
      if (moderationDecision.action === 'perm_ban' || moderationDecision.action === 'temp_ban') {
        return res.status(403).json({
          message: 'Content violates community guidelines',
          code: 'CONTENT_VIOLATION',
          severity: moderationDecision.severity,
          reason: moderationDecision.reason
        });
      }

      if (moderationDecision.action === 'hide' || moderationDecision.action === 'delete') {
        return res.status(400).json({
          message: 'Content filtered for policy violations',
          code: 'CONTENT_FILTERED',
          severity: moderationDecision.severity,
          reason: moderationDecision.reason
        });
      }

      // Create message (it will be processed further by moderation system)
      const message = await storage.createMessage({
        ...messageData,
        authorHumanId: humanId,
        authorRole: userRole || 'verified'
      });

      // Update rate limits
      await storage.incrementRateLimit(humanId, 'message', 'minute');
      await storage.incrementRateLimit(humanId, 'message', 'hour');
      await storage.incrementRateLimit(humanId, 'message', 'day');

      if (messageData.link) {
        await storage.incrementRateLimit(humanId, 'work_link', 'minute');
        await storage.incrementRateLimit(humanId, 'work_link', 'hour');
      }

      // Update participation metrics
      const participationUpdate: Partial<any> = {
        messagesPosted: 1
      };
      
      if (messageData.link) {
        participationUpdate.workLinksShared = 1;
      }
      
      if (messageData.category === 'help') {
        participationUpdate.helpPostsCreated = 1;
      } else if (messageData.category === 'advice') {
        participationUpdate.advicePostsCreated = 1;
      } else if (messageData.category === 'collab') {
        participationUpdate.collabPostsCreated = 1;
      }

      await storage.updateParticipationMetrics(humanId, message.room, participationUpdate);

      // Post-process moderation decision with actual message ID
      if (moderationDecision.action !== 'approve') {
        await automatedModeration.moderateContent(
          message.id,
          messageData.text,
          humanId,
          {
            room: messageData.room,
            isFirstMessage,
            hasUrls: !!messageData.link,
            language: req.headers['accept-language']?.split(',')[0] || 'en'
          }
        );
      }

      // Update user trust score based on posting behavior
      await automatedModeration.updateUserTrustScore(humanId, {
        type: 'message_posted',
        details: { room: message.room, hasLink: !!messageData.link }
      });

      // Track topic engagement for global room messages
      if (message.room === 'global') {
        try {
          const currentTopic = await storage.getCurrentTopic();
          if (currentTopic) {
            await storage.recordTopicEngagement(message.id, currentTopic.id);
          }
        } catch (error) {
          console.error('Error tracking topic engagement:', error);
          // Don't fail the message creation if topic tracking fails
        }
      }

      // Award immediate points for posting message
      const messagePoints = 5; // Base points for posting
      await storage.createPointTransaction({
        humanId,
        type: 'earn',
        source: 'message',
        points: messagePoints,
        description: `Points earned for posting message in ${message.room} room`,
        messageId: message.id
      });

      // Get message with author info for broadcast
      const messages = await storage.getMessages(message.room, 1);
      const messageWithAuthor = messages[0];

      // Broadcast to WebSocket clients
      broadcast({
        type: 'new_message',
        data: messageWithAuthor
      });

      // Update presence and broadcast
      const presence = await storage.getOnlinePresence();
      broadcast({
        type: 'presence_update',
        data: presence
      });

      console.log(`[post] role=${userRole} accepted messageId=${message.id} humanId=${humanId} room=${message.room}`);
      res.json(messageWithAuthor);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // Star a message (requires authentication)
  app.post('/api/stars', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      // Check if user is verified
      if (req.userRole === 'guest') {
        return res.status(403).json({
          message: 'Verify with World ID to star messages',
          code: 'VERIFICATION_REQUIRED'
        });
      }
      
      const humanId = req.humanId!;
      const starData = insertStarSchema.parse(req.body);

      // Check if user already starred this message
      const existingStar = await storage.getUserStarForMessage(starData.messageId, humanId);
      if (existingStar) {
        return res.status(400).json({ 
          message: 'You have already starred this message',
          code: 'ALREADY_STARRED'
        });
      }

      // Rate limiting for stars
      const rateCheck = await checkRateLimit(humanId, 'star');
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: `Slow down on the stars! Try again in ${rateCheck.cooldownSeconds} seconds.`,
          code: 'RATE_LIMITED',
          cooldownSeconds: rateCheck.cooldownSeconds
        });
      }

      // Create star
      const star = await storage.createStar({
        ...starData,
        humanId
      });

      // Update rate limit
      await storage.incrementRateLimit(humanId, 'star', 'minute');

      // Update participation metrics for star giver
      const message = await storage.getMessageById(starData.messageId);
      if (message) {
        await storage.updateParticipationMetrics(humanId, message.room, {
          starsGiven: 1
        });

        // Update participation metrics for star receiver
        await storage.updateParticipationMetrics(message.authorHumanId, message.room, {
          starsReceived: 1
        });

        // Award points to the message author for receiving a star
        const starPoints = 15; // Bonus points for receiving a star
        await storage.createPointTransaction({
          humanId: message.authorHumanId,
          type: 'earn',
          source: 'star',
          points: starPoints,
          description: `Bonus points for receiving a star on your message`,
          messageId: starData.messageId
        });

        // Broadcast star event with point information
        broadcast({
          type: 'message_starred',
          data: {
            messageId: starData.messageId,
            newStarCount: message.starsCount,
            authorEarnedPoints: starPoints
          }
        });
      }

      console.log(`Star given: ${humanId} -> ${starData.messageId}`);
      res.json(star);
    } catch (error) {
      console.error('Error starring message:', error);
      res.status(500).json({ message: 'Failed to star message' });
    }
  });

  // Report a message (requires authentication)
  app.post('/api/reports', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      // Check if user is verified
      if (req.userRole === 'guest') {
        return res.status(403).json({
          message: 'Verify with World ID to report messages',
          code: 'VERIFICATION_REQUIRED'
        });
      }
      
      const humanId = req.humanId!;
      const reportData = insertReportSchema.parse(req.body);

      const report = await storage.createReport({
        ...reportData,
        reporterHumanId: humanId
      });

      // Update user trust score for making a report
      await automatedModeration.updateUserTrustScore(humanId, {
        type: 'report_made',
        details: { messageId: reportData.messageId }
      });

      console.log(`Report submitted: ${humanId} -> ${reportData.messageId}`);
      res.json({ 
        message: 'Thanks. We\'ll review and keep this space healthy.',
        reportId: report.id
      });
    } catch (error) {
      console.error('Error reporting message:', error);
      res.status(500).json({ message: 'Failed to submit report' });
    }
  });

  // ===== ENHANCED MODERATION API ENDPOINTS =====

  // Content pre-screening endpoint
  app.post('/api/moderation/prescreen', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const { content, room } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: 'Content is required' });
      }

      const moderationDecision = await automatedModeration.moderateContent(
        'prescreen_' + Date.now(),
        content,
        humanId,
        {
          room: room || 'global',
          isFirstMessage: false,
          hasUrls: /https?:\/\//.test(content)
        }
      );

      res.json({
        allowed: moderationDecision.action === 'approve',
        action: moderationDecision.action,
        reason: moderationDecision.reason,
        severity: moderationDecision.severity,
        confidence: moderationDecision.confidence
      });
    } catch (error) {
      console.error('Error in content prescreening:', error);
      res.status(500).json({ message: 'Prescreening failed' });
    }
  });

  // Get user moderation profile
  app.get('/api/moderation/profile/:userId?', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.params.userId || req.humanId!;
      
      // Only allow users to view their own profile or admins to view any
      const adminKey = req.headers['x-admin-key'] as string;
      if (humanId !== req.humanId && (!adminKey || adminKey !== process.env.ADMIN_KEY)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const profile = await storage.getUserModerationProfile(humanId);
      res.json(profile);
    } catch (error) {
      console.error('Error fetching moderation profile:', error);
      res.status(500).json({ message: 'Failed to fetch profile' });
    }
  });

  // Submit moderation appeal
  app.post('/api/moderation/appeals', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const { originalActionId, reason, additionalContext } = req.body;

      if (!originalActionId || !reason) {
        return res.status(400).json({ message: 'Action ID and reason are required' });
      }

      const result = await automatedModeration.processAppeal(
        originalActionId,
        humanId,
        reason,
        additionalContext
      );

      res.json(result);
    } catch (error) {
      console.error('Error processing appeal:', error);
      res.status(500).json({ message: 'Failed to process appeal' });
    }
  });

  // Get user appeals
  app.get('/api/moderation/appeals', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const appeals = await storage.getUserAppeals(humanId);
      res.json(appeals);
    } catch (error) {
      console.error('Error fetching appeals:', error);
      res.status(500).json({ message: 'Failed to fetch appeals' });
    }
  });

  // Get user trust score
  app.get('/api/moderation/trust-score', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const trustScore = await storage.getUserTrustScore(humanId);
      
      if (!trustScore) {
        return res.status(404).json({ message: 'Trust score not found' });
      }

      // Return limited information to user (hide sensitive details)
      res.json({
        overallTrustScore: trustScore.overallTrustScore,
        trustLevel: trustScore.trustLevel,
        daysWithoutViolation: trustScore.daysWithoutViolation,
        canReportUsers: trustScore.canReportUsers,
        maxDailyMessages: trustScore.maxDailyMessages,
        requiresReview: trustScore.requiresReview
      });
    } catch (error) {
      console.error('Error fetching trust score:', error);
      res.status(500).json({ message: 'Failed to fetch trust score' });
    }
  });

  // ===== ADMIN MODERATION ENDPOINTS =====

  // Get moderation dashboard
  app.get('/api/admin/moderation/dashboard', authenticateAdmin, async (req, res) => {
    try {
      const dashboard = await storage.getModerationDashboard();
      res.json(dashboard);
    } catch (error) {
      console.error('Error fetching moderation dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard' });
    }
  });

  // Get moderation queue
  app.get('/api/admin/moderation/queue', authenticateAdmin, async (req, res) => {
    try {
      const { status, priority, assignedTo, queueType, limit } = req.query;
      
      const queueItems = await storage.getModerationQueue({
        status: status as string,
        priority: priority as string,
        assignedTo: assignedTo as string,
        queueType: queueType as string,
        limit: limit ? parseInt(limit as string) : undefined
      });
      
      res.json(queueItems);
    } catch (error) {
      console.error('Error fetching moderation queue:', error);
      res.status(500).json({ message: 'Failed to fetch queue' });
    }
  });

  // Process moderation review
  app.post('/api/admin/moderation/review', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const reviewAction = req.body;
      await storage.processModerationReview(reviewAction);
      
      res.json({ message: 'Review processed successfully' });
    } catch (error) {
      console.error('Error processing moderation review:', error);
      res.status(500).json({ message: 'Failed to process review' });
    }
  });

  // Get moderation analytics
  app.get('/api/admin/moderation/analytics', authenticateAdmin, async (req, res) => {
    try {
      const { period, startDate, endDate } = req.query;
      
      const analytics = await storage.getModerationAnalytics({
        period: period as any,
        startDate: startDate as string,
        endDate: endDate as string
      });
      
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching moderation analytics:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  // Assign moderation queue item
  app.patch('/api/admin/moderation/queue/:id/assign', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { assignedTo } = req.body;
      
      await storage.assignModerationQueueItem(id, assignedTo);
      res.json({ message: 'Queue item assigned successfully' });
    } catch (error) {
      console.error('Error assigning queue item:', error);
      res.status(500).json({ message: 'Failed to assign queue item' });
    }
  });

  // Resolve moderation queue item
  app.patch('/api/admin/moderation/queue/:id/resolve', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { actionTaken, reviewNotes } = req.body;
      
      await storage.resolveModerationQueueItem(id, actionTaken, reviewNotes);
      res.json({ message: 'Queue item resolved successfully' });
    } catch (error) {
      console.error('Error resolving queue item:', error);
      res.status(500).json({ message: 'Failed to resolve queue item' });
    }
  });

  // Process moderation appeal (admin)
  app.patch('/api/admin/moderation/appeals/:id', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const { approved, reviewNotes } = req.body;
      const reviewerId = req.humanId!;
      
      const result = await storage.processAppeal(id, approved, reviewNotes, reviewerId);
      res.json(result);
    } catch (error) {
      console.error('Error processing appeal:', error);
      res.status(500).json({ message: 'Failed to process appeal' });
    }
  });

  // Get moderation statistics
  app.get('/api/admin/moderation/stats', authenticateAdmin, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const stats = await storage.getModerationStatsRange(
        startDate as string,
        endDate as string
      );
      
      res.json(stats);
    } catch (error) {
      console.error('Error fetching moderation stats:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  // Get today's theme/topic (legacy endpoint for backward compatibility)
  app.get('/api/theme', async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      let theme = await storage.getThemeForDate(today);
      
      if (!theme) {
        // Try to get from new topic system
        const currentTopic = await storage.getCurrentTopic();
        if (currentTopic) {
          // Convert new topic format to legacy theme format
          theme = {
            id: currentTopic.id,
            date: today,
            topicText: currentTopic.title
          };
        } else {
          theme = await storage.createTheme({
            date: today,
            topicText: "What are you building today?"
          });
        }
      }

      res.json(theme);
    } catch (error) {
      console.error('Error fetching theme:', error);
      res.status(500).json({ message: 'Failed to fetch theme' });
    }
  });

  // Enhanced topic system endpoints
  
  // Get current topic with full context
  app.get('/api/topics/current', async (req, res) => {
    try {
      const currentTopic = await storage.getCurrentTopic();
      res.json(currentTopic);
    } catch (error) {
      console.error('Error fetching current topic:', error);
      res.status(500).json({ message: 'Failed to fetch current topic' });
    }
  });

  // Get daily topic info (current, upcoming, recent)
  app.get('/api/topics/daily-info', async (req, res) => {
    try {
      const dailyInfo = await storage.getDailyTopicInfo();
      res.json(dailyInfo);
    } catch (error) {
      console.error('Error fetching daily topic info:', error);
      res.status(500).json({ message: 'Failed to fetch daily topic info' });
    }
  });

  // Get topics with filters (public endpoint)
  app.get('/api/topics', async (req, res) => {
    try {
      const { category, status = 'approved', limit } = req.query;
      const topics = await storage.getTopics({
        category: category as string,
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined
      });
      res.json(topics);
    } catch (error) {
      console.error('Error fetching topics:', error);
      res.status(500).json({ message: 'Failed to fetch topics' });
    }
  });

  // Get topic analytics (public endpoint)
  app.get('/api/topics/:id/analytics', async (req, res) => {
    try {
      const { id } = req.params;
      const analytics = await storage.getTopicAnalytics(id);
      
      if (!analytics) {
        return res.status(404).json({ message: 'Topic analytics not found' });
      }

      res.json(analytics);
    } catch (error) {
      console.error('Error fetching topic analytics:', error);
      res.status(500).json({ message: 'Failed to fetch topic analytics' });
    }
  });

  // Admin topic management endpoints
  
  // Get all topics (admin only)
  app.get('/api/admin/topics', authenticateAdmin, async (req, res) => {
    try {
      const { category, status, authorId, limit } = req.query;
      const topics = await storage.getTopics({
        category: category as string,
        status: status as string,
        authorId: authorId as string,
        limit: limit ? parseInt(limit as string) : undefined
      });
      res.json(topics);
    } catch (error) {
      console.error('Error fetching admin topics:', error);
      res.status(500).json({ message: 'Failed to fetch topics' });
    }
  });

  // Create new topic (admin only)
  app.post('/api/admin/topics', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const topicData = insertTopicSchema.parse(req.body);

      const topic = await storage.createTopic({
        ...topicData,
        authorHumanId: humanId,
        status: 'draft' // New topics start as drafts
      });

      console.log(`Topic created: ${topic.id} by ${humanId}`);
      res.status(201).json(topic);
    } catch (error) {
      console.error('Error creating topic:', error);
      res.status(500).json({ message: 'Failed to create topic' });
    }
  });

  // Update topic (admin only)
  app.patch('/api/admin/topics/:id', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const topic = await storage.updateTopic(id, updates);
      
      if (!topic) {
        return res.status(404).json({ message: 'Topic not found' });
      }

      console.log(`Topic updated: ${id}`);
      res.json(topic);
    } catch (error) {
      console.error('Error updating topic:', error);
      res.status(500).json({ message: 'Failed to update topic' });
    }
  });

  // Delete topic (admin only)
  app.delete('/api/admin/topics/:id', authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTopic(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Topic not found' });
      }

      console.log(`Topic deleted: ${id}`);
      res.json({ message: 'Topic deleted successfully' });
    } catch (error) {
      console.error('Error deleting topic:', error);
      res.status(500).json({ message: 'Failed to delete topic' });
    }
  });

  // Get topic schedules (admin only)
  app.get('/api/admin/schedules', authenticateAdmin, async (req, res) => {
    try {
      const { startDate, endDate, isActive } = req.query;
      const schedules = await storage.getTopicSchedules({
        startDate: startDate as string,
        endDate: endDate as string,
        isActive: isActive ? isActive === 'true' : undefined
      });
      res.json(schedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ message: 'Failed to fetch schedules' });
    }
  });

  // Create topic schedule (admin only)
  app.post('/api/admin/schedules', authenticateAdmin, async (req, res) => {
    try {
      const scheduleData = insertTopicScheduleSchema.parse(req.body);
      const schedule = await storage.createTopicSchedule(scheduleData);

      console.log(`Topic scheduled: ${schedule.topicId} for ${schedule.scheduledDate}`);
      res.status(201).json(schedule);
    } catch (error) {
      console.error('Error creating schedule:', error);
      res.status(500).json({ message: 'Failed to create schedule' });
    }
  });

  // Update topic schedule (admin only)
  app.patch('/api/admin/schedules/:id', authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const schedule = await storage.updateTopicSchedule(id, updates);
      
      if (!schedule) {
        return res.status(404).json({ message: 'Schedule not found' });
      }

      console.log(`Schedule updated: ${id}`);
      res.json(schedule);
    } catch (error) {
      console.error('Error updating schedule:', error);
      res.status(500).json({ message: 'Failed to update schedule' });
    }
  });

  // Activate topic schedule (admin only)
  app.post('/api/admin/schedules/:id/activate', authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.activateTopicSchedule(id);

      console.log(`Schedule activated: ${id}`);
      res.json({ message: 'Schedule activated successfully' });
    } catch (error) {
      console.error('Error activating schedule:', error);
      res.status(500).json({ message: 'Failed to activate schedule' });
    }
  });

  // Deactivate topic schedule (admin only)
  app.post('/api/admin/schedules/:id/deactivate', authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deactivateTopicSchedule(id);

      console.log(`Schedule deactivated: ${id}`);
      res.json({ message: 'Schedule deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating schedule:', error);
      res.status(500).json({ message: 'Failed to deactivate schedule' });
    }
  });

  // Quick schedule topic for specific date (admin only)
  app.post('/api/admin/topics/:id/schedule', authenticateAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { date } = req.body;

      if (!date) {
        return res.status(400).json({ message: 'Date is required' });
      }

      const schedule = await storage.scheduleTopicRotation(date, id);
      await storage.activateTopicSchedule(schedule.id);

      console.log(`Topic ${id} scheduled for ${date}`);
      res.status(201).json(schedule);
    } catch (error) {
      console.error('Error scheduling topic:', error);
      res.status(500).json({ message: 'Failed to schedule topic' });
    }
  });

  // Get admin summary dashboard (admin only)
  app.get('/api/admin/summary', authenticateAdmin, async (req, res) => {
    try {
      const summary = await storage.getAdminTopicSummary();
      res.json(summary);
    } catch (error) {
      console.error('Error fetching admin summary:', error);
      res.status(500).json({ message: 'Failed to fetch admin summary' });
    }
  });

  // Get topics analytics (admin only)
  app.get('/api/admin/analytics', authenticateAdmin, async (req, res) => {
    try {
      const { category, startDate, endDate } = req.query;
      const analytics = await storage.getTopicsAnalytics({
        category: category as string,
        dateRange: startDate && endDate ? {
          start: startDate as string,
          end: endDate as string
        } : undefined
      });
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ message: 'Failed to fetch analytics' });
    }
  });

  // Trigger topic rotation manually (admin only)
  app.post('/api/admin/rotate-topics', authenticateAdmin, async (req, res) => {
    try {
      await storage.rotateTopics();
      console.log('Manual topic rotation triggered');
      res.json({ message: 'Topic rotation completed successfully' });
    } catch (error) {
      console.error('Error rotating topics:', error);
      res.status(500).json({ message: 'Failed to rotate topics' });
    }
  });

  // Bulk schedule topics (admin only)
  app.post('/api/admin/bulk-schedule', authenticateAdmin, async (req, res) => {
    try {
      const { schedules } = req.body; // Array of { topicId, date }
      
      if (!Array.isArray(schedules)) {
        return res.status(400).json({ message: 'Schedules must be an array' });
      }

      const results = [];
      for (const { topicId, date } of schedules) {
        try {
          const schedule = await storage.scheduleTopicRotation(date, topicId);
          results.push({ success: true, schedule });
        } catch (error) {
          results.push({ success: false, error: error.message, topicId, date });
        }
      }

      console.log(`Bulk scheduling completed: ${results.length} items`);
      res.json({ results });
    } catch (error) {
      console.error('Error bulk scheduling:', error);
      res.status(500).json({ message: 'Failed to bulk schedule topics' });
    }
  });

  // Get human profile
  app.get('/api/profile/:humanId', async (req, res) => {
    try {
      const { humanId } = req.params;
      const profile = await storage.getHumanProfile(humanId);
      
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }

      res.json(profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ message: 'Failed to fetch profile' });
    }
  });

  // Create connect request (requires authentication)
  app.post('/api/connect', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const connectData = insertConnectRequestSchema.parse(req.body);

      const request = await storage.createConnectRequest({
        ...connectData,
        requesterHumanId: humanId
      });

      console.log(`Connect request: ${humanId} -> ${connectData.targetHumanId}`);
      res.json({ 
        message: 'Connect request sent! Future DM feature will notify them.',
        requestId: request.id
      });
    } catch (error) {
      console.error('Error creating connect request:', error);
      res.status(500).json({ message: 'Failed to send connect request' });
    }
  });

  // Get online presence
  app.get('/api/presence', async (req, res) => {
    try {
      const presence = await storage.getOnlinePresence();
      res.json(presence);
    } catch (error) {
      console.error('Error fetching presence:', error);
      res.status(500).json({ message: 'Failed to fetch presence' });
    }
  });

  // Update capsule seen status (requires authentication)
  app.post('/api/capsule-seen', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      await storage.updateHumanCapsuleSeen(humanId);
      
      res.json({ message: 'Capsule seen status updated' });
    } catch (error) {
      console.error('Error updating capsule status:', error);
      res.status(500).json({ message: 'Failed to update capsule status' });
    }
  });

  // Get ledger entries (Room Rain history)
  app.get('/api/ledger', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const entries = await storage.getLedgerEntries(limit);
      res.json(entries);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      res.status(500).json({ message: 'Failed to fetch ledger' });
    }
  });

  // Mute/unmute user (requires authentication)
  app.post('/api/mute', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const { targetHumanId, action } = req.body;

      if (!targetHumanId || !['mute', 'unmute'].includes(action)) {
        return res.status(400).json({ message: 'Invalid mute request' });
      }

      const human = await storage.getHuman(humanId);
      if (!human) {
        return res.status(404).json({ message: 'Human not found' });
      }

      let muteList = [...human.muteList];
      
      if (action === 'mute' && !muteList.includes(targetHumanId)) {
        muteList.push(targetHumanId);
      } else if (action === 'unmute') {
        muteList = muteList.filter(id => id !== targetHumanId);
      }

      await storage.updateHumanMuteList(humanId, muteList);

      res.json({ 
        message: `User ${action}d successfully`,
        muteList
      });
    } catch (error) {
      console.error('Error updating mute list:', error);
      res.status(500).json({ message: 'Failed to update mute list' });
    }
  });

  // Point System API Endpoints

  // Get user point balance (requires authentication)
  app.get('/api/points/balance', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const balance = await storage.getUserPointBalance(humanId);
      
      if (!balance) {
        // Create initial balance if doesn't exist
        const newBalance = await storage.createUserPointBalance({
          humanId,
          totalPoints: 0,
          lifetimeEarned: 0,
          lifetimeSpent: 0
        });
        return res.json(newBalance);
      }

      res.json(balance);
    } catch (error) {
      console.error('Error fetching point balance:', error);
      res.status(500).json({ message: 'Failed to fetch point balance' });
    }
  });

  // Get user point history (requires authentication)
  app.get('/api/points/history', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const history = await storage.getUserPointHistory(humanId);
      res.json(history);
    } catch (error) {
      console.error('Error fetching point history:', error);
      res.status(500).json({ message: 'Failed to fetch point history' });
    }
  });

  // Get user point transactions (requires authentication)
  app.get('/api/points/transactions', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = await storage.getUserPointTransactions(humanId, limit);
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching point transactions:', error);
      res.status(500).json({ message: 'Failed to fetch point transactions' });
    }
  });

  // Get leaderboard
  app.get('/api/points/leaderboard', async (req, res) => {
    try {
      const period = (req.query.period as 'daily' | 'weekly' | 'all') || 'all';
      const limit = parseInt(req.query.limit as string) || 10;
      
      const leaderboard = await storage.getLeaderboard(period, limit);
      res.json(leaderboard);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
  });

  // Get user rank (requires authentication)
  app.get('/api/points/rank', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const period = (req.query.period as 'daily' | 'weekly' | 'all') || 'all';
      
      const rank = await storage.getUserRank(humanId, period);
      res.json({ rank, period });
    } catch (error) {
      console.error('Error fetching user rank:', error);
      res.status(500).json({ message: 'Failed to fetch user rank' });
    }
  });

  // Get distribution events
  app.get('/api/points/distributions', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const events = await storage.getDistributionEvents(limit);
      res.json(events);
    } catch (error) {
      console.error('Error fetching distribution events:', error);
      res.status(500).json({ message: 'Failed to fetch distribution events' });
    }
  });

  // Get specific distribution event
  app.get('/api/points/distributions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const event = await storage.getDistributionEventById(id);
      
      if (!event) {
        return res.status(404).json({ message: 'Distribution event not found' });
      }

      res.json(event);
    } catch (error) {
      console.error('Error fetching distribution event:', error);
      res.status(500).json({ message: 'Failed to fetch distribution event' });
    }
  });

  // Admin endpoint: Trigger daily distribution (requires authentication)
  app.post('/api/points/distribute/daily', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const { room } = req.body;
      
      if (!['global', 'work'].includes(room)) {
        return res.status(400).json({ message: 'Invalid room' });
      }

      // Calculate distribution
      const distributionSummary = await storage.calculateDailyDistribution(room);
      
      if (distributionSummary.totalParticipants === 0) {
        return res.json({ 
          message: 'No eligible users for distribution',
          summary: distributionSummary
        });
      }

      // Create distribution event
      const distributionEvent = await storage.createDistributionEvent({
        type: 'daily_rain',
        title: `Daily Room Rain - ${room.charAt(0).toUpperCase() + room.slice(1)} Square`,
        description: `Daily point distribution for active participants in ${room} room`,
        totalPoints: distributionSummary.totalPointsDistributed,
        participantCount: distributionSummary.totalParticipants,
        room,
        calculationData: {
          timeRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          },
          pointsPerMessage: 10,
          pointsPerStar: 25,
          activityMultiplier: 1.2,
          workModeBonus: room === 'work' ? 1.5 : 1.0
        }
      });

      // Execute distribution
      await storage.executeDistribution(distributionSummary, distributionEvent.id);

      // Broadcast distribution event
      broadcast({
        type: 'points_distributed',
        data: {
          event: distributionEvent,
          summary: distributionSummary
        }
      });

      console.log(`Daily distribution executed: ${room} room, ${distributionSummary.totalPointsDistributed} points to ${distributionSummary.totalParticipants} users`);
      
      res.json({
        message: 'Daily distribution completed successfully',
        event: distributionEvent,
        summary: distributionSummary
      });
    } catch (error) {
      console.error('Error executing daily distribution:', error);
      res.status(500).json({ message: 'Failed to execute daily distribution' });
    }
  });

  // Admin endpoint: Trigger weekly distribution (requires authentication)
  app.post('/api/points/distribute/weekly', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const { room } = req.body;
      
      if (!['global', 'work'].includes(room)) {
        return res.status(400).json({ message: 'Invalid room' });
      }

      // Calculate distribution
      const distributionSummary = await storage.calculateWeeklyDistribution(room);
      
      if (distributionSummary.totalParticipants === 0) {
        return res.json({ 
          message: 'No eligible users for distribution',
          summary: distributionSummary
        });
      }

      // Create distribution event
      const distributionEvent = await storage.createDistributionEvent({
        type: 'weekly_rain',
        title: `Weekly Bonus Rain - ${room.charAt(0).toUpperCase() + room.slice(1)} Square`,
        description: `Weekly bonus distribution for consistent contributors in ${room} room`,
        totalPoints: distributionSummary.totalPointsDistributed,
        participantCount: distributionSummary.totalParticipants,
        room,
        calculationData: {
          timeRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          },
          pointsPerMessage: 15,
          pointsPerStar: 40,
          activityMultiplier: 1.3,
          workModeBonus: room === 'work' ? 2.0 : 1.0
        }
      });

      // Execute distribution
      await storage.executeDistribution(distributionSummary, distributionEvent.id);

      // Broadcast distribution event
      broadcast({
        type: 'points_distributed',
        data: {
          event: distributionEvent,
          summary: distributionSummary
        }
      });

      console.log(`Weekly distribution executed: ${room} room, ${distributionSummary.totalPointsDistributed} points to ${distributionSummary.totalParticipants} users`);
      
      res.json({
        message: 'Weekly distribution completed successfully',
        event: distributionEvent,
        summary: distributionSummary
      });
    } catch (error) {
      console.error('Error executing weekly distribution:', error);
      res.status(500).json({ message: 'Failed to execute weekly distribution' });
    }
  });

  // =============================================================================
  // INVITE SYSTEM API ENDPOINTS
  // =============================================================================

  // Generate a new invite code
  app.post('/api/invites/generate', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const { customMessage, maxUsage, expiresAt } = req.body;

      // Rate limiting for invite code generation
      const rateCheck = await checkRateLimit(humanId, 'invite_generate');
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: 'You can only generate 3 invite codes per day. Try again tomorrow.',
          code: 'RATE_LIMITED',
          cooldownSeconds: rateCheck.cooldownSeconds
        });
      }

      const inviteCode = await storage.createInviteCode({
        creatorHumanId: humanId,
        customMessage: customMessage || null,
        maxUsage: maxUsage || 100,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        metadata: {
          source: 'app',
          version: 'v1'
        }
      });

      // Update rate limit
      await storage.incrementRateLimit(humanId, 'invite_generate', 'day');

      res.json({
        message: 'Invite code generated successfully',
        inviteCode
      });
    } catch (error) {
      console.error('Error generating invite code:', error);
      res.status(500).json({ message: 'Failed to generate invite code' });
    }
  });

  // Get user's invite codes with statistics
  app.get('/api/invites/my-codes', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const codes = await storage.getUserInviteCodes(humanId);
      res.json(codes);
    } catch (error) {
      console.error('Error fetching invite codes:', error);
      res.status(500).json({ message: 'Failed to fetch invite codes' });
    }
  });

  // Validate an invite code (public endpoint)
  app.get('/api/invites/validate/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const validation = await storage.validateInviteCode(code);
      
      // Track analytics for link click
      if (validation.inviteCode) {
        await storage.trackInviteEvent(validation.inviteCode.id, 'link_click', {
          sessionId: req.sessionID,
          userAgent: req.headers['user-agent'],
          referrer: req.headers.referer,
          ipCountry: req.headers['cf-ipcountry'] || 'unknown'
        });
      }

      res.json(validation);
    } catch (error) {
      console.error('Error validating invite code:', error);
      res.status(500).json({ message: 'Failed to validate invite code' });
    }
  });

  // Process a referral when someone joins via invite code
  app.post('/api/invites/process-referral', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!; // The new user (invitee)
      const { inviteCode } = req.body;

      if (!inviteCode) {
        return res.status(400).json({ message: 'Invite code is required' });
      }

      // Validate the invite code
      const validation = await storage.validateInviteCode(inviteCode);
      if (!validation.valid || !validation.inviteCode) {
        return res.status(400).json({ 
          message: validation.reason || 'Invalid invite code',
          code: 'INVALID_INVITE_CODE'
        });
      }

      // Check if user already used this invite code (prevent self-referral and duplicates)
      const existingReferral = await storage.getReferralsByInvitee(humanId);
      if (existingReferral.length > 0) {
        return res.status(400).json({
          message: 'You have already used an invite code',
          code: 'ALREADY_REFERRED'
        });
      }

      // Check for self-referral
      if (validation.inviteCode.creatorHumanId === humanId) {
        return res.status(400).json({
          message: 'You cannot use your own invite code',
          code: 'SELF_REFERRAL'
        });
      }

      // Create the referral
      const referral = await storage.createReferral({
        inviterHumanId: validation.inviteCode.creatorHumanId,
        inviteeHumanId: humanId,
        inviteCodeId: validation.inviteCode.id,
        inviteCode: validation.inviteCode.code,
        status: 'completed',
        completedAt: new Date(),
        metadata: {
          joinedViaUrl: req.headers.referer,
          userAgent: req.headers['user-agent'],
          ipCountry: req.headers['cf-ipcountry'] || 'unknown'
        }
      });

      // Update invite code usage
      await storage.updateInviteCodeUsage(validation.inviteCode.id);

      // Distribute rewards
      await storage.distributeReferralRewards(referral.id);

      // Track analytics
      await storage.trackInviteEvent(validation.inviteCode.id, 'registration_complete', {
        sessionId: req.sessionID,
        referralId: referral.id
      });

      // Broadcast successful referral notification
      broadcast({
        type: 'referral_success',
        data: {
          inviter: validation.inviteCode.creatorHumanId,
          invitee: humanId,
          referralId: referral.id
        }
      });

      res.json({
        message: 'Referral processed successfully',
        referral,
        rewards: await storage.calculateReferralRewards(referral.id)
      });
    } catch (error) {
      console.error('Error processing referral:', error);
      res.status(500).json({ message: 'Failed to process referral' });
    }
  });

  // Get referral dashboard for authenticated user
  app.get('/api/referrals/dashboard', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const dashboard = await storage.getReferralDashboard(humanId);
      res.json(dashboard);
    } catch (error) {
      console.error('Error fetching referral dashboard:', error);
      res.status(500).json({ message: 'Failed to fetch referral dashboard' });
    }
  });

  // Get referral leaderboard
  app.get('/api/referrals/leaderboard', async (req, res) => {
    try {
      const { period = 'all_time', limit = 10 } = req.query;
      const leaderboard = await storage.getReferralLeaderboard(
        period as string, 
        parseInt(limit as string)
      );

      // Mark current user if authenticated
      const humanId = req.headers['x-world-id-proof'] 
        ? crypto.createHash('sha256').update(req.headers['x-world-id-proof'] as string).digest('hex')
        : null;

      if (humanId) {
        leaderboard.forEach(entry => {
          if (entry.humanId === humanId) {
            entry.isCurrentUser = true;
          }
        });
      }

      res.json(leaderboard);
    } catch (error) {
      console.error('Error fetching referral leaderboard:', error);
      res.status(500).json({ message: 'Failed to fetch referral leaderboard' });
    }
  });

  // Get invite analytics for a specific code
  app.get('/api/invites/:codeId/analytics', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const { codeId } = req.params;

      // Verify that the user owns this invite code
      const inviteCode = await storage.getInviteCode(codeId);
      if (!inviteCode || inviteCode.creatorHumanId !== humanId) {
        return res.status(403).json({ 
          message: 'You do not have permission to view analytics for this invite code',
          code: 'FORBIDDEN'
        });
      }

      const analytics = await storage.getInviteAnalyticsSummary(codeId);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching invite analytics:', error);
      res.status(500).json({ message: 'Failed to fetch invite analytics' });
    }
  });

  // Get user's referral history
  app.get('/api/referrals/history', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const { type = 'inviter' } = req.query;

      let referrals: ReferralWithDetails[];
      if (type === 'inviter') {
        referrals = await storage.getReferralsByInviter(humanId);
      } else {
        referrals = await storage.getReferralsByInvitee(humanId);
      }

      res.json(referrals);
    } catch (error) {
      console.error('Error fetching referral history:', error);
      res.status(500).json({ message: 'Failed to fetch referral history' });
    }
  });

  // Get user's milestones and achievements
  app.get('/api/referrals/milestones', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const milestones = await storage.getUserMilestones(humanId);
      const nextMilestone = await storage.getNextMilestone(humanId);

      res.json({
        milestones,
        nextMilestone
      });
    } catch (error) {
      console.error('Error fetching milestones:', error);
      res.status(500).json({ message: 'Failed to fetch milestones' });
    }
  });

  // Admin endpoint: Get referral system statistics
  app.get('/api/admin/referrals/stats', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storage.getReferralSystemStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching referral system stats:', error);
      res.status(500).json({ message: 'Failed to fetch referral system stats' });
    }
  });

  // Admin endpoint: Update referral leaderboards (manual refresh)
  app.post('/api/admin/referrals/refresh-leaderboards', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.updateReferralLeaderboards();
      res.json({ message: 'Referral leaderboards refreshed successfully' });
    } catch (error) {
      console.error('Error refreshing referral leaderboards:', error);
      res.status(500).json({ message: 'Failed to refresh referral leaderboards' });
    }
  });

  // Update rate limiting helper to include invite operations
  async function checkRateLimit(humanId: string, action: string): Promise<{ allowed: boolean; cooldownSeconds?: number }> {
    const limits = {
      'message_minute': RATE_LIMITS.MESSAGES_PER_MIN,
      'message_hour': RATE_LIMITS.MESSAGES_PER_HOUR,
      'message_day': RATE_LIMITS.MESSAGES_PER_DAY,
      'star_minute': RATE_LIMITS.STARS_PER_MIN,
      'work_link_10min': RATE_LIMITS.WORK_LINKS_PER_10MIN,
      'work_link_hour': RATE_LIMITS.WORK_LINKS_PER_HOUR,
      'invite_generate': 3, // 3 invite codes per day
    };

    if (action === 'message') {
      const [perMin, perHour, perDay] = await Promise.all([
        storage.getRateLimit(humanId, 'message', 'minute'),
        storage.getRateLimit(humanId, 'message', 'hour'),
        storage.getRateLimit(humanId, 'message', 'day'),
      ]);

      if (perMin >= RATE_LIMITS.MESSAGES_PER_MIN) {
        return { allowed: false, cooldownSeconds: 60 };
      }
      if (perHour >= RATE_LIMITS.MESSAGES_PER_HOUR) {
        return { allowed: false, cooldownSeconds: 3600 };
      }
      if (perDay >= RATE_LIMITS.MESSAGES_PER_DAY) {
        return { allowed: false, cooldownSeconds: 86400 };
      }
    }

    if (action === 'star') {
      const perMin = await storage.getRateLimit(humanId, 'star', 'minute');
      if (perMin >= RATE_LIMITS.STARS_PER_MIN) {
        return { allowed: false, cooldownSeconds: 60 };
      }
    }

    if (action === 'work_link') {
      const [per10Min, perHour] = await Promise.all([
        storage.getRateLimit(humanId, 'work_link', 'minute'), // Use minute as 10min proxy
        storage.getRateLimit(humanId, 'work_link', 'hour'),
      ]);

      // Rough 10-minute check (not exact, but sufficient for demo)
      if (per10Min >= RATE_LIMITS.WORK_LINKS_PER_10MIN) {
        return { allowed: false, cooldownSeconds: 600 };
      }
      if (perHour >= RATE_LIMITS.WORK_LINKS_PER_HOUR) {
        return { allowed: false, cooldownSeconds: 3600 };
      }
    }

    if (action === 'invite_generate') {
      const perDay = await storage.getRateLimit(humanId, 'invite_generate', 'day');
      if (perDay >= 3) {
        return { allowed: false, cooldownSeconds: 86400 };
      }
    }

    return { allowed: true };
  }

  // World ID Verification endpoint
  app.post('/api/verify/worldid', handleGuestSession, async (req: AuthenticatedRequest, res) => {
    try {
      const { proof, nullifier_hash, merkle_root } = req.body;

      // Basic validation
      if (!proof || !nullifier_hash || !merkle_root) {
        return res.status(400).json({
          message: 'Missing World ID verification data',
          code: 'INVALID_REQUEST'
        });
      }

      // In production, verify the proof with World ID Cloud API
      // For now, we'll simulate verification
      const verifyWorldIdProof = async (proof: string, nullifierHash: string) => {
        // TODO: Implement actual World ID verification
        // const response = await fetch('https://developer.worldcoin.org/api/v1/verify', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({
        //     app_id: WORLDID_CONFIG.APP_ID,
        //     action: WORLDID_CONFIG.ACTION,
        //     signal: '',
        //     proof,
        //     nullifier_hash: nullifierHash,
        //     merkle_root
        //   })
        // });
        // return response.ok;
        
        // Simulated verification for development
        return true;
      };

      const isValid = await verifyWorldIdProof(proof, nullifier_hash);
      
      if (!isValid) {
        return res.status(400).json({
          message: 'Invalid World ID proof',
          code: 'INVALID_PROOF'
        });
      }

      // Hash the nullifier to create the human ID
      const humanId = crypto.createHash('sha256')
        .update(nullifier_hash + WORLDID_CONFIG.APP_ID)
        .digest('hex');

      // Check if human exists, create if not
      let human = await storage.getHuman(humanId);
      if (!human) {
        human = await storage.createHuman({ 
          id: humanId,
          role: 'verified'
        });
      } else if (human.role === 'guest') {
        // Upgrade from guest to verified
        await storage.updateHumanRole(humanId, 'verified');
      }

      res.json({
        success: true,
        humanId,
        role: 'verified',
        message: 'Successfully verified with World ID'
      });
    } catch (error) {
      console.error('World ID verification error:', error);
      res.status(500).json({
        message: 'Failed to verify World ID',
        code: 'VERIFICATION_ERROR'
      });
    }
  });

  // Permit2 Verification endpoint (foundation for future token transfers)
  app.post('/api/permit2/verify', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      // Check if Permit2 feature is enabled
      if (!POLICY.enablePermit2) {
        return res.status(503).json({ 
          ok: false, 
          error: 'Permit2 verification is temporarily unavailable' 
        });
      }

      const { signature, amount, deadline, nonce, token, spender } = req.body;

      // Basic validation
      if (!signature || !amount || !deadline || !nonce || !token || !spender) {
        return res.status(400).json({
          ok: false,
          error: 'Missing Permit2 signature data'
        });
      }

      // Check if user is verified
      if (req.userRole === 'guest') {
        return res.status(403).json({
          ok: false,
          error: 'Verify with World ID to use Permit2 features'
        });
      }

      // Verify deadline hasn't passed
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (currentTimestamp > deadline) {
        return res.status(400).json({
          ok: false,
          error: 'Permit2 signature has expired'
        });
      }

      // In production, verify the EIP-712 signature here
      // For now, we'll just validate the structure
      const verifyPermit2Signature = async (
        sig: string,
        amt: string,
        dl: number,
        nc: number
      ): Promise<boolean> => {
        // TODO: Implement actual EIP-712 signature verification
        // This would involve:
        // 1. Reconstructing the typed data hash
        // 2. Recovering the signer address
        // 3. Validating the signer is the expected user
        
        // For development, just check signature format
        return sig.startsWith('0x') && sig.length === 132;
      };

      const isValid = await verifyPermit2Signature(signature, amount, deadline, nonce);

      if (!isValid) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid signature'
        });
      }

      // Store the signature for future use (no actual transfers - just verification)
      await storage.createPermit2Signature({
        humanId: req.humanId!,
        tokenId: token, // This would be resolved to a token ID in production
        signature,
        amount,
        deadline,
        nonce,
        spender,
        used: false
      });

      // Return success - no actual token transfers, just signature verification
      res.json({
        ok: true
      });
    } catch (error) {
      console.error('Permit2 verification error:', error);
      res.status(500).json({
        ok: false,
        error: 'Failed to verify Permit2 signature'
      });
    }
  });

  return httpServer;
}
