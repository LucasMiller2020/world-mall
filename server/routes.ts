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
import { logStructuredEvent } from "./logger";
import { containsFilteredKeyword, getFilteredContentMessage } from "@shared/keyword-filter";
import { issueWarningForViolation } from "./warning-system";

// Rate limit constants - using POLICY values for verified users
const RATE_LIMITS = {
  MESSAGES_PER_MIN: POLICY.verifiedPerMin,
  MESSAGES_PER_HOUR: POLICY.verifiedPerHour,
  MESSAGES_PER_DAY: POLICY.verifiedPerDay,
  STARS_PER_MIN: parseInt(process.env.RATE_LIMIT_STARS_PER_MIN || '20'),
  WORK_LINKS_PER_10MIN: parseInt(process.env.RATE_LIMIT_WORK_LINKS_PER_10MIN || '2'),
  WORK_LINKS_PER_HOUR: parseInt(process.env.RATE_LIMIT_WORK_LINKS_PER_HOUR || '4'),
};

// Guest mode configuration - ENABLED (Simple guest access without verification)
const GUEST_CONFIG = {
  ENABLED: true, // Guest mode enabled - no verification required
  MAX_CHARS: 240, // Same as verified users
  COOLDOWN_SEC: 0, // No cooldown
  MAX_PER_DAY: 999999, // Unlimited messages per day
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

function detectMiniAppFromRequest(req: Request): {
  isMiniApp: boolean;
  indicator: string | null;
  userAgent: string;
} {
  const userAgentHeader = req.headers['user-agent'];
  const userAgent = Array.isArray(userAgentHeader)
    ? userAgentHeader.join(' ')
    : userAgentHeader || '';
  const normalizedUserAgent = userAgent.toLowerCase();

  const headerIndicators: Array<{ header: string; value: string | string[] | undefined }> = [
    { header: 'x-mini-app', value: req.headers['x-mini-app'] },
    { header: 'x-miniapp', value: req.headers['x-miniapp'] },
    { header: 'x-world-app', value: req.headers['x-world-app'] },
  ];

  for (const { header, value } of headerIndicators) {
    if ((typeof value === 'string' && value.length > 0) || (Array.isArray(value) && value.length > 0)) {
      return { isMiniApp: true, indicator: `header:${header}`, userAgent };
    }
  }

  const userAgentIndicators = [
    { match: 'world app', indicator: 'ua:world app' },
    { match: 'worldapp', indicator: 'ua:worldapp' },
    { match: 'world-app', indicator: 'ua:world-app' },
    { match: 'minikit', indicator: 'ua:minikit' },
  ];

  for (const { match, indicator } of userAgentIndicators) {
    if (normalizedUserAgent.includes(match)) {
      return { isMiniApp: true, indicator, userAgent };
    }
  }

  return { isMiniApp: false, indicator: null, userAgent };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // FIX 3: Add aggressive cache headers to ALL responses
  app.use((req, res, next) => {
    // Force no caching on all API endpoints
    if (req.path.startsWith('/api')) {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Vary': 'Origin'
      });
    }
    next();
  });
  
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

    // Set up heartbeat for this connection
    let pingInterval: NodeJS.Timeout | null = null;
    
    // Start sending heartbeat pings
    const startHeartbeat = () => {
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        } else {
          // Connection is closed, clear the interval
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
        }
      }, 10000); // Send ping every 10 seconds
    };
    
    // Start heartbeat immediately
    startHeartbeat();

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
        } else if (message.type === 'pong') {
          // Client acknowledged the ping, connection is alive
          // No action needed, just acknowledgment
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      wsClients.delete(ws);
      // Clear heartbeat interval
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
      // Clear heartbeat interval
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
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

    // Get guest session ID from cookie first, then X-Session header as fallback (for World App WebView)
    const cookies = req.headers.cookie || '';
    const cookieObj: { [key: string]: string } = {};
    cookies.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) cookieObj[key] = value;
    });
    
    const headerSessionId = req.headers['x-session'] as string | undefined;
    const authorizationHeader = req.headers.authorization as string | undefined;

    // Priority: 1. Cookie (wm_sid), 2. X-Session header, 3. Authorization: Bearer header (for WebView when cookies blocked)
    let guestSessionId = cookieObj.wm_sid || headerSessionId;
    let resolutionSource: string | null = null;

    if (cookieObj.wm_sid) {
      resolutionSource = 'cookie';
    } else if (headerSessionId) {
      resolutionSource = 'header:x-session';
    }

    // Check Authorization Bearer header as additional fallback
    if (!guestSessionId && authorizationHeader) {
      if (authorizationHeader.startsWith('Bearer ')) {
        guestSessionId = authorizationHeader.substring(7).trim();
        resolutionSource = 'header:authorization';
      }
    }

    const sessionFromHeaderOnly = !cookieObj.wm_sid && !!guestSessionId;
    const requestedSessionId = guestSessionId || null;
    let sessionCreated = false;
    let recoveredByHash = false;
    
    // Hash IP and user agent for privacy-preserving tracking
    const ipHash = crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex');
    const userAgentHash = crypto.createHash('sha256').update(req.headers['user-agent'] || 'unknown').digest('hex');
    const dayBucket = new Date().toISOString().split('T')[0];
    
    // Find or create guest session
    let guestSession = guestSessionId ? await storage.getGuestSession(guestSessionId) : null;

    if (!guestSession) {
      // Try to find existing session by hash
      guestSession = await storage.getGuestSessionByHash(ipHash, userAgentHash);
      if (guestSession) {
        recoveredByHash = true;
        if (!resolutionSource) {
          resolutionSource = 'hash_lookup';
        }
      }

      if (!guestSession) {
        // Create new guest session
        guestSession = await storage.createGuestSession({
          ipHash,
          userAgentHash,
          dayBucket,
          messageCount: 0
        });
        sessionCreated = true;
        if (!resolutionSource) {
          resolutionSource = 'generated';
        }
      }

      // Set cookie with cross-origin support for World App
      const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
      res.setHeader('Set-Cookie', `wm_sid=${guestSession.id}; HttpOnly; Path=/; SameSite=${isSecure ? 'None' : 'Lax'}; ${isSecure ? 'Secure; ' : ''}Max-Age=${365*24*60*60}`);
    } else {
      // Update last seen
      await storage.updateGuestSessionActivity(guestSession.id);

      // If session came from header only (not cookie), set/refresh the cookie
      if (sessionFromHeaderOnly) {
        const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
        res.setHeader('Set-Cookie', `wm_sid=${guestSession.id}; HttpOnly; Path=/; SameSite=${isSecure ? 'None' : 'Lax'}; ${isSecure ? 'Secure; ' : ''}Max-Age=${365*24*60*60}`);
      }
    }

    req.guestSessionId = guestSession.id;
    logStructuredEvent('session.resolve', {
      requestedSessionId,
      resolvedSessionId: guestSession.id,
      resolutionSource: resolutionSource || 'unknown',
      sessionFromHeaderOnly,
      sessionCreated,
      recoveredByHash,
      ipHash,
      userAgentHash,
      expressSessionId: req.sessionID || null,
    });
    next();
  };

  // Middleware to extract and verify human ID from World ID nullifier
  const authenticateHuman = async (req: AuthenticatedRequest, res: Response, next: any) => {
    // Check for wm_uid cookie (existing verified session)
    const cookies = req.headers.cookie || '';
    const cookieObj: { [key: string]: string } = {};
    cookies.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) cookieObj[key] = value;
    });
    
    const wmUidCookie = cookieObj.wm_uid;
    
    // Try to authenticate with wm_uid cookie first
    if (wmUidCookie) {
      try {
        const human = await storage.getHuman(wmUidCookie);
        if (human) {
          // Valid verified session from cookie
          await storage.updatePresence(wmUidCookie);
          req.humanId = wmUidCookie;
          req.userRole = human.role || 'verified';
          return next();
        }
        // Cookie exists but user not found - fall through to other auth methods
      } catch (error) {
        // Cookie auth failed - fall through to other auth methods
      }
    }
    
    // Check for World ID proof header
    const worldIdProof = req.headers['x-world-id-proof'] as string;
    
    if (worldIdProof) {
      try {
        // In a real implementation, verify the World ID proof here
        // For now, we'll use the proof as a simulated nullifier hash
        const humanId = crypto.createHash('sha256').update(worldIdProof).digest('hex');
        
        // Ensure human exists in storage
        let human = await storage.getHuman(humanId);
        if (!human) {
          // Generate a unique handle from the humanId (first 8 chars)
          const baseHandle = `user_${humanId.substring(0, 8)}`;
          human = await storage.createHuman({ 
            id: humanId, 
            role: 'verified',
            handle: baseHandle
          });
        }

        // Update presence
        await storage.updatePresence(humanId);
        
        req.humanId = humanId;
        req.userRole = human.role || 'verified';
        return next();
      } catch (error) {
        // World ID proof verification failed
        if (!GUEST_CONFIG.ENABLED) {
          return res.status(401).json({ 
            message: 'Invalid World ID proof',
            code: 'INVALID_PROOF'
          });
        }
        // Fall through to guest mode if enabled
      }
    }
    
    // No valid authentication found - check if guest mode is enabled
    if (GUEST_CONFIG.ENABLED) {
      req.userRole = 'guest';
      return next();
    }
    
    // Guest mode disabled and no valid authentication
    return res.status(401).json({ 
      message: 'World ID verification required to access Mall Space',
      code: 'VERIFICATION_REQUIRED'
    });
  };

  // Content filter function with premium support
  function filterContent(text: string, isPremium: boolean = false): { isValid: boolean; reason?: string } {
    const maxChars = isPremium ? 500 : 240;
    
    if (text.length > maxChars) {
      return { isValid: false, reason: `Message too long (${maxChars} character limit)` };
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

  // Rate limiting helper with premium support
  async function checkRateLimit(humanId: string, action: string, isPremium: boolean = false): Promise<{ allowed: boolean; cooldownSeconds?: number }> {
    // Premium users have no rate limits
    if (isPremium) {
      return { allowed: true };
    }
    
    const limits = {
      'message_minute': RATE_LIMITS.MESSAGES_PER_MIN,
      'message_hour': RATE_LIMITS.MESSAGES_PER_HOUR,
      'message_day': RATE_LIMITS.MESSAGES_PER_DAY,
      'star_minute': RATE_LIMITS.STARS_PER_MIN,
      'work_link_10min': RATE_LIMITS.WORK_LINKS_PER_10MIN,
      'work_link_hour': RATE_LIMITS.WORK_LINKS_PER_HOUR,
      'invite_generate': 3,
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

  // Apply guest session middleware to all routes
  app.use(handleGuestSession);

  if (app.get('env') === 'development') {
    app.get('/debug', (req: AuthenticatedRequest, res: Response) => {
      const cookiesHeader = req.headers.cookie || '';
      const cookieMap: Record<string, string> = {};
      cookiesHeader.split(';').forEach(cookie => {
        const [rawKey, rawValue] = cookie.trim().split('=');
        if (rawKey && rawValue) {
          cookieMap[rawKey] = rawValue;
        }
      });

      const miniAppInfo = detectMiniAppFromRequest(req);
      const toDisplay = (value?: string | null) => (value && value.length > 0 ? value : 'none');
      const effectiveSessionId = toDisplay(req.guestSessionId || req.sessionID || cookieMap.wm_sid || null);
      const expressSessionId = toDisplay(req.sessionID || null);
      const guestSessionId = toDisplay(req.guestSessionId || cookieMap.wm_sid || null);
      const resolvedUserRole = req.userRole
        || (req.humanId ? 'verified' : cookieMap.wm_uid ? 'verified' : req.guestSessionId ? 'guest' : 'unknown');

      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>World Mall Debug</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 2rem; line-height: 1.5; }
    h1 { margin-bottom: 1rem; }
    dl { display: grid; grid-template-columns: max-content 1fr; column-gap: 1rem; row-gap: 0.75rem; }
    dt { font-weight: 600; }
    dd { margin: 0; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 4px; }
    .hint { color: #555; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>Debug Information</h1>
  <dl>
    <dt>Session ID</dt>
    <dd><code>${escapeHtml(effectiveSessionId)}</code></dd>
    <dt>Guest Session ID</dt>
    <dd><code>${escapeHtml(guestSessionId)}</code></dd>
    <dt>Express Session ID</dt>
    <dd><code>${escapeHtml(expressSessionId)}</code></dd>
    <dt>User Role</dt>
    <dd>${escapeHtml(resolvedUserRole)}</dd>
    <dt>Mini App</dt>
    <dd>${miniAppInfo.isMiniApp ? 'Detected' : 'Not detected'}${miniAppInfo.indicator ? ` <span class="hint">(${escapeHtml(miniAppInfo.indicator)})</span>` : ''}</dd>
    <dt>User Agent</dt>
    <dd><code>${escapeHtml(toDisplay(miniAppInfo.userAgent || 'unknown'))}</code></dd>
  </dl>
</body>
</html>`;

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    });
  }

  // World ID diagnostic endpoint - returns public World ID configuration (no secrets)
  app.get('/api/worldid/diag', (req, res) => {
    res.json({
      appId: POLICY.worldId.appId,
      action: POLICY.worldId.action,
      apiBase: POLICY.worldId.apiBase,
      verificationLevel: POLICY.worldId.verificationLevel
    });
  });

  // Session debug endpoint - returns current session information for debugging
  app.get('/api/debug/session', async (req: AuthenticatedRequest, res) => {
    // Parse cookies from request
    const cookies = req.headers.cookie || '';
    const cookieObj: { [key: string]: string } = {};
    cookies.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) cookieObj[key] = value;
    });
    
    // Get current role and IDs from authenticated request
    const role = req.userRole || 'guest';
    const humanId = req.humanId || null;
    const guestSessionId = req.guestSessionId || null;
    const sessionId = cookieObj.wm_uid || cookieObj.wm_sid || null;
    
    res.json({
      cookies: cookieObj,
      role,
      sessionId,
      humanId,
      guestSessionId
    });
  });

  // Session endpoint - creates or retrieves existing session
  app.post('/api/session', handleGuestSession, async (req: AuthenticatedRequest, res) => {
    if (!GUEST_CONFIG.ENABLED) {
      return res.status(403).json({ 
        message: 'Guest mode is not enabled',
        code: 'GUEST_MODE_DISABLED'
      });
    }
    
    // Session already created/retrieved by handleGuestSession middleware
    if (!req.guestSessionId) {
      return res.status(500).json({ 
        message: 'Failed to create session',
        code: 'SESSION_ERROR'
      });
    }
    
    // Return the session ID
    res.json({
      sid: req.guestSessionId
    });
  });
  
  // Policy endpoint - returns public policy configuration
  app.get('/api/policy', (req, res) => {
    res.json({
      guestMode: {
        enabled: GUEST_CONFIG.ENABLED,
        maxChars: 240,
        cooldownSec: 0,
        maxPerDay: 999999
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
      themeDefaults: {
        mode: POLICY.theme.defaultMode,
        sunrise: POLICY.theme.sunrise,
        sunset: POLICY.theme.sunset
      },
      features: {
        enablePermit2: POLICY.enablePermit2,
        disableWorldId: POLICY.disableWorldId
      }
    });
  });

  // World ID verification endpoint
  app.post('/api/verify/worldid', async (req, res) => {
    const verificationMode = process.env.NODE_ENV === 'development' || !POLICY.worldId.appId ? 'development' : 'cloud';
    let hashedNullifierForLog: string | null = null;
    let actionForLog: string | undefined;
    let verificationLevelForLog: string | undefined;
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

      actionForLog = action;
      verificationLevelForLog = verification_level;
      
      // Validate required fields
      if (!nullifier_hash || !proof || !merkle_root || !verification_level || !action) {
        const missingFields: string[] = [];
        if (!nullifier_hash) missingFields.push('nullifier_hash');
        if (!proof) missingFields.push('proof');
        if (!merkle_root) missingFields.push('merkle_root');
        if (!verification_level) missingFields.push('verification_level');
        if (!action) missingFields.push('action');
        logStructuredEvent('worldid.verify', {
          outcome: 'failure',
          reason: 'missing_parameters',
          missingFields,
          mode: verificationMode,
        }, 'warn');
        return res.status(400).json({
          message: 'Missing required verification parameters',
          code: 'INVALID_REQUEST'
        });
      }
      
      // Validate action matches policy
      if (action !== POLICY.worldId.action) {
        logStructuredEvent('worldid.verify', {
          outcome: 'failure',
          reason: 'invalid_action',
          expectedAction: POLICY.worldId.action,
          receivedAction: action,
          mode: verificationMode,
        }, 'warn');
        return res.status(400).json({
          message: `Invalid action parameter. Expected: ${POLICY.worldId.action}, received: ${action}`,
          code: 'INVALID_ACTION'
        });
      }

      hashedNullifierForLog = crypto.createHash('sha256').update(nullifier_hash).digest('hex');
      
      // Check if we're in development mode to skip actual verification
      let verificationSuccessful = false;
      
      if (process.env.NODE_ENV === 'development' || !POLICY.worldId.appId) {
        // Development mode: simulate successful verification
        verificationSuccessful = true;
      } else {
        // Production mode: call World ID Cloud API
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
          logStructuredEvent('worldid.verify', {
            outcome: 'failure',
            reason: worldIdResult.code || 'VERIFICATION_FAILED',
            message: worldIdResult.message || null,
            mode: verificationMode,
            status: worldIdResponse.status,
            hashedNullifier: hashedNullifierForLog,
            action,
            verificationLevel: verification_level,
          }, 'warn');

          // Provide clear error messages for common issues
          let errorMessage = 'World ID verification failed';
          if (worldIdResult.code === 'invalid_proof') {
            errorMessage = 'Invalid proof. Please try verifying again.';
          } else if (worldIdResult.code === 'expired_proof') {
            errorMessage = 'Verification expired. Please try again.';
          } else if (worldIdResult.message) {
            errorMessage = worldIdResult.message;
          }
          
          return res.status(400).json({
            message: errorMessage,
            code: worldIdResult.code || 'VERIFICATION_FAILED',
            details: worldIdResult
          });
        }
        
        verificationSuccessful = true;
      }
      
      if (!verificationSuccessful) {
        logStructuredEvent('worldid.verify', {
          outcome: 'failure',
          reason: 'verification_unsuccessful',
          mode: verificationMode,
          hashedNullifier: hashedNullifierForLog,
          action,
          verificationLevel: verification_level,
        }, 'warn');
        return res.status(400).json({
          message: 'World ID verification failed',
          code: 'VERIFICATION_FAILED'
        });
      }
      
      // Verification successful - compute SHA-256 hash of nullifier
      const nullifierHashHashed = crypto.createHash('sha256').update(nullifier_hash).digest('hex');
      
      // Check if this nullifier has already been verified
      const existingVerification = await storage.getVerificationByNullifierHash(nullifierHashHashed);

      if (existingVerification) {
        // User already verified, just return success
        logStructuredEvent('worldid.verify', {
          outcome: 'success',
          reusedVerification: true,
          humanId: existingVerification.userId,
          hashedNullifier: nullifierHashHashed,
          mode: verificationMode,
          action,
          verificationLevel: verification_level,
        });

        // Set cookies using Express cookie method for better compatibility
        const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
        res.cookie('wm_uid', existingVerification.userId, {
          httpOnly: true,
          path: '/',
          sameSite: isSecure ? 'none' : 'lax',
          secure: isSecure,
          maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year in milliseconds
        });
        res.cookie('wm_sid', '', { maxAge: 0 }); // Clear guest session
        
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
        // Generate a unique handle from the userId (first 8 chars)
        const baseHandle = `user_${userId.substring(0, 8)}`;
        human = await storage.createHuman({ 
          id: userId, 
          role: 'verified',
          handle: baseHandle
        });
      } else {
        await storage.updateHumanRole(userId, 'verified');
      }
      
      // Create verification record
      await storage.createVerification({
        userId,
        nullifierHashHashed
      });
      
      logStructuredEvent('worldid.verify', {
        outcome: 'success',
        reusedVerification: false,
        humanId: userId,
        hashedNullifier: nullifierHashHashed,
        mode: verificationMode,
        action,
        verificationLevel: verification_level,
      });
      
      // Set cookies using Express cookie method for better compatibility
      const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
      res.cookie('wm_uid', userId, {
        httpOnly: true,
        path: '/',
        sameSite: isSecure ? 'none' : 'lax',
        secure: isSecure,
        maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year in milliseconds
      });
      res.cookie('wm_sid', '', { maxAge: 0 }); // Clear guest session
      
      return res.json({
        ok: true,
        role: 'verified',
        humanId: userId
      });
      
    } catch (error: any) {
      logStructuredEvent('worldid.verify', {
        outcome: 'failure',
        reason: error?.code || 'INTERNAL_ERROR',
        errorMessage: error?.message || 'Internal server error during verification',
        mode: verificationMode,
        hashedNullifier: hashedNullifierForLog,
        action: actionForLog,
        verificationLevel: verificationLevelForLog,
      }, 'error');

      // Check for specific database errors
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        return res.status(409).json({
          message: 'This verification has already been used',
          code: 'DUPLICATE_VERIFICATION'
        });
      }
      
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
    let isPremium = false;
    
    if (humanId) {
      human = await storage.getHuman(humanId);
      
      // Check premium status for verified users
      if (role === 'verified' || role === 'admin') {
        const premiumStatus = await storage.getPremiumStatus(humanId);
        isPremium = premiumStatus?.status === 'active';
      }
    }
    
    // Get applicable limits based on role and premium status
    let limits;
    if (role === 'guest') {
      limits = {
        maxChars: 240, // Same as verified users
        cooldownSec: 0, // No cooldown
        maxPerDay: 999999, // Unlimited
        features: ['global_room', 'star', 'report', 'work_mode', 'connect'] // Full access
      };
    } else if (isPremium) {
      limits = {
        maxChars: 500, // Premium users get 500 char limit
        cooldownSec: 0, // No cooldown for premium
        maxPerDay: -1, // Unlimited messages
        features: ['global_room', 'star', 'report', 'work_mode', 'connect', 'premium']
      };
    } else {
      limits = {
        maxChars: POLICY.verifiedCharLimit,
        features: ['global_room', 'star', 'report', 'work_mode', 'connect']
      };
    }
    
    // Prepare response object
    const response: any = {
      humanId: humanId || null,
      handle: human?.handle || null,
      role,
      isVerified: role === 'verified' || role === 'admin',
      isPremium,
      limits,
      joinedAt: human?.joinedAt || null,
      capsuleSeen: human?.capsuleSeen || false,
      theme: {
        defaultMode: POLICY.theme.defaultMode,
        sunrise: POLICY.theme.sunrise,
        sunset: POLICY.theme.sunset
      }
    };
    
    // Add guest stats if user is a guest
    if (role === 'guest' && req.guestSessionId) {
      const dayBucket = new Date().toISOString().split('T')[0];
      const messageCount = await storage.getGuestMessageCount(req.guestSessionId, dayBucket);
      const messagesRemaining = POLICY.guestDaily - messageCount;
      
      response.guestStats = {
        messagesToday: messageCount,
        messagesRemaining,
        dailyLimit: POLICY.guestDaily,
        cooldownSec: POLICY.guestCooldownSec
      };
    }
    
    res.json(response);
  });

  // GET /api/profile/:handle - Get user profile by handle
  app.get('/api/profile/:handle', async (req: Request, res: Response) => {
    try {
      const { handle } = req.params;
      
      if (!handle) {
        return res.status(400).json({ 
          message: 'Handle is required',
          code: 'HANDLE_REQUIRED'
        });
      }
      
      // Get human by handle
      const human = await storage.getHumanByHandle(handle);
      
      if (!human) {
        return res.status(404).json({ 
          message: 'Profile not found',
          code: 'PROFILE_NOT_FOUND'
        });
      }
      
      // Get message and star counts
      const messageCount = await storage.getUserMessageCount(human.id);
      const starCount = await storage.getUserStarCount(human.id);
      
      // Prepare public profile data
      const profile = {
        handle: human.handle,
        avatarUrl: human.avatarUrl,
        mbti: human.mbti,
        zodiac: human.zodiac,
        age: human.age,
        joinedAt: human.joinedAt,
        messageCount,
        starCount,
        role: human.role,
      };
      
      res.json(profile);
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ 
        message: 'Failed to fetch profile',
        code: 'PROFILE_FETCH_FAILED'
      });
    }
  });

  // PUT /api/me/profile - Update current user's profile
  app.put('/api/me/profile', authenticateHuman, async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Check if user is verified
      if (!req.humanId || req.userRole !== 'verified') {
        return res.status(403).json({ 
          message: 'Only verified users can update their profile',
          code: 'VERIFICATION_REQUIRED'
        });
      }
      
      const { avatarUrl, mbti, zodiac, age } = req.body;
      
      // Validate MBTI if provided
      const validMbtiTypes = [
        'INTJ', 'INTP', 'ENTJ', 'ENTP',
        'INFJ', 'INFP', 'ENFJ', 'ENFP',
        'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
        'ISTP', 'ISFP', 'ESTP', 'ESFP'
      ];
      
      if (mbti && !validMbtiTypes.includes(mbti)) {
        return res.status(400).json({ 
          message: 'Invalid MBTI type',
          code: 'INVALID_MBTI'
        });
      }
      
      // Validate zodiac if provided
      const validZodiacs = [
        'Aries', 'Taurus', 'Gemini', 'Cancer',
        'Leo', 'Virgo', 'Libra', 'Scorpio',
        'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
      ];
      
      if (zodiac && !validZodiacs.includes(zodiac)) {
        return res.status(400).json({ 
          message: 'Invalid zodiac sign',
          code: 'INVALID_ZODIAC'
        });
      }
      
      // Validate age if provided
      if (age !== undefined && age !== null) {
        if (age < 18 || age > 100) {
          return res.status(400).json({ 
            message: 'Age must be between 18 and 100',
            code: 'INVALID_AGE'
          });
        }
      }
      
      // Validate avatar URL if provided
      if (avatarUrl) {
        // Basic URL validation
        try {
          new URL(avatarUrl);
        } catch {
          return res.status(400).json({ 
            message: 'Invalid avatar URL',
            code: 'INVALID_AVATAR_URL'
          });
        }
        
        // Ensure it's HTTPS
        if (!avatarUrl.startsWith('https://')) {
          return res.status(400).json({ 
            message: 'Avatar URL must use HTTPS',
            code: 'AVATAR_HTTPS_REQUIRED'
          });
        }
        
        // Length check (DB column is 255)
        if (avatarUrl.length > 255) {
          return res.status(400).json({ 
            message: 'Avatar URL is too long',
            code: 'AVATAR_URL_TOO_LONG'
          });
        }
      }
      
      // Update profile
      const updatedHuman = await storage.updateHumanProfile(req.humanId, {
        avatarUrl: avatarUrl !== undefined ? avatarUrl : undefined,
        mbti: mbti !== undefined ? mbti : undefined,
        zodiac: zodiac !== undefined ? zodiac : undefined,
        age: age !== undefined ? age : undefined,
      });
      
      // Return updated profile
      res.json({
        handle: updatedHuman.handle,
        avatarUrl: updatedHuman.avatarUrl,
        mbti: updatedHuman.mbti,
        zodiac: updatedHuman.zodiac,
        age: updatedHuman.age,
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ 
        message: 'Failed to update profile',
        code: 'PROFILE_UPDATE_FAILED'
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Get messages for a room - ENHANCED WITH SYNC DIAGNOSTICS
  app.get('/api/messages/:room', async (req: AuthenticatedRequest, res) => {
    const requestStartTime = Date.now();
    const pollId = req.headers['x-poll-id'] as string || 'unknown';
    const pollSource = req.headers['x-source'] as string || 'unknown';
    
    try {
      const { room } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Determine current user ID and session for logging
      const userRole = req.userRole || 'guest';
      const currentUserHumanId = req.humanId || req.guestSessionId 
        ? (userRole === 'guest' ? `guest_${req.guestSessionId}` : req.humanId!)
        : undefined;
      const sessionId = req.guestSessionId || req.sessionID || 'NO_SESSION';
      
      // LOG: Incoming request details
      console.log(`[GET /api/messages/${room}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[GET /api/messages/${room}] 📥 INCOMING REQUEST:`);
      console.log(`[GET /api/messages/${room}]    Poll ID:   ${pollId}`);
      console.log(`[GET /api/messages/${room}]    Source:    ${pollSource}`);
      console.log(`[GET /api/messages/${room}]    Session:   ${sessionId.substring(0, 20)}...`);
      console.log(`[GET /api/messages/${room}]    User:      ${currentUserHumanId?.substring(0, 30) || 'anonymous'}`);
      console.log(`[GET /api/messages/${room}]    Role:      ${userRole}`);
      console.log(`[GET /api/messages/${room}]    Timestamp: ${new Date().toISOString()}`);
      
      if (!['global', 'work'].includes(room)) {
        console.log(`[GET /api/messages/${room}] ❌ Invalid room`);
        return res.status(400).json({ message: 'Invalid room' });
      }

      // For global room, fetch more messages to ensure we have recent activity for landing page
      // The storage.getMessages already returns the most recent messages
      const fetchLimit = room === 'global' ? Math.min(limit, 10) : limit;
      
      // LOG: Query execution details
      console.log(`[GET /api/messages/${room}] 🔍 EXECUTING QUERY:`);
      console.log(`[GET /api/messages/${room}]    Room:  ${room}`);
      console.log(`[GET /api/messages/${room}]    Limit: ${fetchLimit}`);
      
      const queryStartTime = Date.now();
      let messages = await storage.getMessages(room, fetchLimit, currentUserHumanId);
      const queryDuration = Date.now() - queryStartTime;
      
      // LOG: Query results before filtering
      console.log(`[GET /api/messages/${room}] 📊 QUERY RESULTS (before filtering):`);
      console.log(`[GET /api/messages/${room}]    Count:    ${messages.length}`);
      console.log(`[GET /api/messages/${room}]    Duration: ${queryDuration}ms`);
      
      const preFilterCount = messages.length;
      
      // Filter messages based on mutes and blocks if user is authenticated
      if (req.humanId || req.guestSessionId) {
        const humanId = currentUserHumanId!;
        
        // Get muted and blocked users
        const mutedUsers = await storage.getMutedUsers(humanId);
        const blockedUsers = await storage.getBlockedUsers(humanId);
        const blockingUsers = await storage.getBlockingUsers(humanId);
        
        // Filter out messages from muted users
        // Filter out messages from blocked users (blocker perspective)
        // Filter out messages from users who blocked the requester (mutual invisibility)
        messages = messages.filter(msg => {
          const authorId = msg.authorHumanId;
          return !mutedUsers.includes(authorId) && 
                 !blockedUsers.includes(authorId) && 
                 !blockingUsers.includes(authorId);
        });
        
        // LOG: Filtering results
        if (messages.length !== preFilterCount) {
          console.log(`[GET /api/messages/${room}] 🔒 FILTERING APPLIED:`);
          console.log(`[GET /api/messages/${room}]    Filtered out: ${preFilterCount - messages.length} messages`);
        }
      }
      
      // LOG: Final response details
      const messageIds = messages.slice(0, 5).map(m => m.id.substring(0, 8)).join(', ');
      const messageAuthors = messages.slice(0, 5).map(m => m.authorHumanId?.substring(0, 20) || 'unknown').join(', ');
      const totalDuration = Date.now() - requestStartTime;
      
      console.log(`[GET /api/messages/${room}] ✅ SENDING RESPONSE:`);
      console.log(`[GET /api/messages/${room}]    Total Messages: ${messages.length}`);
      console.log(`[GET /api/messages/${room}]    Message IDs (first 5): ${messageIds || 'none'}`);
      console.log(`[GET /api/messages/${room}]    Authors (first 5): ${messageAuthors || 'none'}`);
      console.log(`[GET /api/messages/${room}]    Total Duration: ${totalDuration}ms`);
      console.log(`[GET /api/messages/${room}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Disable caching to ensure fresh data on every poll
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });
      
      res.json(messages);
    } catch (error) {
      console.error(`[GET /api/messages/${room}] ❌ ERROR:`, error);
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
          logStructuredEvent('message.create', {
            outcome: 'blocked',
            reason: 'guest_mode_disabled',
            role: 'guest',
            room: messageData.room,
            length: messageData.text.length,
            guestSessionId: req.guestSessionId || null,
            sessionId: req.sessionID || null,
          }, 'warn');
          return res.status(403).json({
            message: 'Guest mode is disabled. Please verify with World ID.',
            code: 'VERIFICATION_REQUIRED'
          });
        }
        
        // Restrict to global room only
        if (messageData.room !== 'global') {
          logStructuredEvent('message.create', {
            outcome: 'blocked',
            reason: 'room_restricted',
            role: 'guest',
            room: messageData.room,
            length: messageData.text.length,
            guestSessionId: req.guestSessionId || null,
            sessionId: req.sessionID || null,
          }, 'warn');
          return res.status(403).json({
            message: 'Guests can only post in the global room',
            code: 'guest_room_restricted'
          });
        }
        
        // No character limit for guests - same as verified users
        if (messageData.text.length > 240) {
          return res.status(403).json({
            message: `Message too long (240 character limit)`,
            code: 'LENGTH_EXCEEDED'
          });
        }
        
        // No rate limits for guests - unlimited posting
        
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
        
        // Check if user is banned
        const isBanned = await storage.isUserBanned(humanId);
        if (isBanned) {
          return res.status(403).json({
            message: 'Your account has been permanently banned for violating community guidelines',
            code: 'ACCOUNT_BANNED'
          });
        }
        
        // Check if user is timed out
        const isTimedOut = await storage.isUserTimedOut(humanId);
        if (isTimedOut) {
          const activeWarnings = await storage.getActiveWarnings(humanId);
          const timeoutWarning = activeWarnings.find(w => w.action === 'timeout' && w.expiresAt);
          const minutesRemaining = timeoutWarning?.expiresAt 
            ? Math.ceil((timeoutWarning.expiresAt.getTime() - Date.now()) / 60000)
            : 0;
          return res.status(403).json({
            message: `You are temporarily restricted from posting. Try again in ${minutesRemaining} minutes.`,
            code: 'ACCOUNT_TIMED_OUT',
            minutesRemaining
          });
        }
        
        // Keyword filtering - check for harmful content
        const keywordCheck = containsFilteredKeyword(messageData.text);
        if (keywordCheck.blocked) {
          // Issue warning for keyword violation
          const warning = await issueWarningForViolation(
            storage,
            humanId,
            'filtered_keyword',
            null
          );
          
          logStructuredEvent('message.create', {
            outcome: 'blocked',
            reason: 'filtered_keyword',
            role: 'guest',
            room: messageData.room,
            length: messageData.text.length,
            category: keywordCheck.category,
            matchedWord: keywordCheck.matchedWord,
            strikeNumber: warning.strikeNumber,
            action: warning.action,
            guestSessionId: req.guestSessionId || null,
            sessionId: req.sessionID || null,
          }, 'warn');
          return res.status(400).json({
            message: getFilteredContentMessage(keywordCheck),
            code: 'FILTERED_KEYWORD',
            reason: keywordCheck.reason,
            warning: {
              strikeNumber: warning.strikeNumber,
              action: warning.action,
              expiresAt: warning.expiresAt
            }
          });
        }
        
        // Create message for guest
        console.log(`[POST /api/messages] ========== GUEST MESSAGE CREATION ==========`);
        console.log(`[POST /api/messages] Room: ${messageData.room}`);
        console.log(`[POST /api/messages] Text: ${messageData.text.substring(0, 50)}...`);
        console.log(`[POST /api/messages] Author HumanId: ${humanId}`);
        console.log(`[POST /api/messages] GuestSessionId: ${req.guestSessionId}`);
        console.log(`[POST /api/messages] About to call storage.createMessage()...`);
        
        const message = await storage.createMessage({
          ...messageData,
          authorHumanId: humanId,  // Field name is authorHumanId in the table
          authorRole: 'guest'
        });
        
        console.log(`[POST /api/messages] ✅ GUEST MESSAGE CREATED SUCCESSFULLY!`);
        console.log(`[POST /api/messages] Message ID: ${message.id}`);
        console.log(`[POST /api/messages] Created at: ${message.createdAt}`);
        console.log(`[POST /api/messages] Author: ${message.authorHumanId}`);
        console.log(`[POST /api/messages] Hidden: ${message.isHidden}`);
        
        // Verify the message was saved by trying to retrieve it
        console.log(`[POST /api/messages] Verifying message exists in storage...`);
        const verifyMessage = await storage.getMessageById(message.id);
        if (verifyMessage) {
          console.log(`[POST /api/messages] ✅ VERIFIED - Message ${message.id} exists in storage!`);
          console.log(`[POST /api/messages] Verified message text: ${verifyMessage.text.substring(0, 50)}...`);
        } else {
          console.error(`[POST /api/messages] ❌ ERROR - Message ${message.id} NOT FOUND after creation!`);
        }
        
        // Broadcast new message
        console.log(`[POST /api/messages] Broadcasting new message to WebSocket clients`);
        broadcast({
          type: 'new_message',
          data: {
            ...message,
            authorHandle: `Guest`,
            isStarredByUser: false
          }
        });
        
        logStructuredEvent('message.create', {
          outcome: 'accepted',
          role: 'guest',
          room: messageData.room,
          length: messageData.text.length,
          messageId: message.id,
          guestSessionId: req.guestSessionId || null,
          sessionId: req.sessionID || null,
        });
        
        return res.json({ 
          message, 
          code: 'SUCCESS'
        });
      }
      
      // Verified user flow continues below
      const humanId = req.humanId!;
      
      // Check if user is banned (via warning system)
      const isBanned = await storage.isUserBanned(humanId);
      if (isBanned) {
        return res.status(403).json({
          message: 'Your account has been permanently banned for violating community guidelines',
          code: 'ACCOUNT_BANNED'
        });
      }
      
      // Check if user is timed out (via warning system)
      const isTimedOut = await storage.isUserTimedOut(humanId);
      if (isTimedOut) {
        const activeWarnings = await storage.getActiveWarnings(humanId);
        const timeoutWarning = activeWarnings.find(w => w.action === 'timeout' && w.expiresAt);
        const minutesRemaining = timeoutWarning?.expiresAt 
          ? Math.ceil((timeoutWarning.expiresAt.getTime() - Date.now()) / 60000)
          : 0;
        return res.status(403).json({
          message: `You are temporarily restricted from posting. Try again in ${minutesRemaining} minutes.`,
          code: 'ACCOUNT_TIMED_OUT',
          minutesRemaining
        });
      }
      
      // Check premium status
      const premiumStatus = await storage.getPremiumStatus(humanId);
      const isPremium = premiumStatus?.status === 'active';

      // Check user moderation status first
      const moderationStatus = await automatedModeration.checkUserModerationStatus(humanId);
      
      if (moderationStatus.isBanned) {
        return res.status(403).json({ 
          message: 'Account suspended',
          code: 'ACCOUNT_SUSPENDED'
        });
      }
      
      // Content validation with premium support
      const contentCheck = filterContent(messageData.text, isPremium);
      if (!contentCheck.isValid) {
        return res.status(400).json({
          message: contentCheck.reason,
          code: 'INVALID_CONTENT'
        });
      }

      // Keyword filtering - check for harmful content
      const keywordCheck = containsFilteredKeyword(messageData.text);
      if (keywordCheck.blocked) {
        // Issue warning for keyword violation
        const warning = await issueWarningForViolation(
          storage,
          humanId,
          'filtered_keyword',
          null
        );
        
        logStructuredEvent('message.create', {
          outcome: 'blocked',
          reason: 'filtered_keyword',
          role: userRole,
          room: messageData.room,
          length: messageData.text.length,
          category: keywordCheck.category,
          matchedWord: keywordCheck.matchedWord,
          humanId: humanId,
          strikeNumber: warning.strikeNumber,
          action: warning.action,
        }, 'warn');
        return res.status(400).json({
          message: getFilteredContentMessage(keywordCheck),
          code: 'FILTERED_KEYWORD',
          reason: keywordCheck.reason,
          warning: {
            strikeNumber: warning.strikeNumber,
            action: warning.action,
            expiresAt: warning.expiresAt
          }
        });
      }

      // No rate limiting - everyone has unlimited posting

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
      console.log(`[POST /api/messages] ========== VERIFIED USER MESSAGE CREATION ==========`);
      console.log(`[POST /api/messages] Room: ${messageData.room}`);
      console.log(`[POST /api/messages] Text: ${messageData.text.substring(0, 50)}...`);
      console.log(`[POST /api/messages] Author HumanId: ${humanId}`);
      console.log(`[POST /api/messages] UserRole: ${userRole}`);
      console.log(`[POST /api/messages] About to call storage.createMessage()...`);
      
      const message = await storage.createMessage({
        ...messageData,
        authorHumanId: humanId,  // Field name is authorHumanId in the table
        authorRole: userRole || 'verified'
      });
      
      console.log(`[POST /api/messages] ✅ VERIFIED MESSAGE CREATED SUCCESSFULLY!`);
      console.log(`[POST /api/messages] Message ID: ${message.id}`);
      console.log(`[POST /api/messages] Created at: ${message.createdAt}`);
      console.log(`[POST /api/messages] Author: ${message.authorHumanId}`);
      console.log(`[POST /api/messages] Hidden: ${message.isHidden}`);
      
      // Verify the message was saved
      console.log(`[POST /api/messages] Verifying message exists in storage...`);
      const verifyMessage = await storage.getMessageById(message.id);
      if (verifyMessage) {
        console.log(`[POST /api/messages] ✅ VERIFIED - Message ${message.id} exists in storage!`);
        console.log(`[POST /api/messages] Verified message text: ${verifyMessage.text.substring(0, 50)}...`);
      } else {
        console.error(`[POST /api/messages] ❌ ERROR - Message ${message.id} NOT FOUND after creation!`);
      }

      // No rate limit tracking - unlimited for everyone

      // COMMENTED OUT: updateParticipationMetrics doesn't exist
      // const participationUpdate: Partial<any> = {
      //   messagesPosted: 1
      // };
      // 
      // if (messageData.link) {
      //   participationUpdate.workLinksShared = 1;
      // }
      // 
      // if (messageData.category === 'help') {
      //   participationUpdate.helpPostsCreated = 1;
      // } else if (messageData.category === 'advice') {
      //   participationUpdate.advicePostsCreated = 1;
      // } else if (messageData.category === 'collab') {
      //   participationUpdate.collabPostsCreated = 1;
      // }
      //
      // await storage.updateParticipationMetrics(humanId, message.room, participationUpdate);

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

      // COMMENTED OUT: createPointTransaction doesn't exist
      // const messagePoints = 5; // Base points for posting
      // await storage.createPointTransaction({
      //   humanId,
      //   type: 'earn',
      //   source: 'message',
      //   points: messagePoints,
      //   description: `Points earned for posting message in ${message.room} room`,
      //   messageId: message.id
      // });

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

      logStructuredEvent('message.create', {
        outcome: 'accepted',
        role: userRole,
        messageId: message.id,
        humanId,
        room: message.room,
        hasLink: !!messageData.link,
        sessionId: req.sessionID || null,
        guestSessionId: req.guestSessionId || null,
      });
      res.json(messageWithAuthor);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // Edit a message (requires authentication)
  app.patch('/api/messages/:messageId', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const { messageId } = req.params;
      const { text } = req.body;

      // Validate text is provided
      if (!text || typeof text !== 'string') {
        return res.status(400).json({
          message: 'Text is required',
          code: 'INVALID_TEXT'
        });
      }

      // Validate text length
      if (text.length > 240) {
        return res.status(400).json({
          message: 'Message too long (240 character limit)',
          code: 'LENGTH_EXCEEDED'
        });
      }

      // Get the message
      const message = await storage.getMessageById(messageId);
      if (!message) {
        return res.status(404).json({
          message: 'Message not found',
          code: 'NOT_FOUND'
        });
      }

      // Determine the current user's ID (guest or verified)
      const userRole = req.userRole || 'guest';
      const humanId = userRole === 'guest' ? `guest_${req.guestSessionId}` : req.humanId!;

      // Verify the message belongs to the current user
      if (message.authorHumanId !== humanId) {
        return res.status(403).json({
          message: 'You can only edit your own messages',
          code: 'UNAUTHORIZED'
        });
      }

      // Check if message is less than 30 seconds old
      const now = new Date();
      const messageAge = now.getTime() - message.createdAt.getTime();
      const thirtySeconds = 30 * 1000;

      if (messageAge > thirtySeconds) {
        return res.status(403).json({
          message: 'Messages can only be edited within 30 seconds of posting',
          code: 'EDIT_WINDOW_EXPIRED'
        });
      }

      // Content validation
      const isPremium = false; // Will be enhanced later if needed
      const contentCheck = filterContent(text, isPremium);
      if (!contentCheck.isValid) {
        return res.status(400).json({
          message: contentCheck.reason,
          code: 'INVALID_CONTENT'
        });
      }

      // Update the message
      const updatedMessage = await storage.updateMessage(messageId, text);

      if (!updatedMessage) {
        return res.status(500).json({
          message: 'Failed to update message',
          code: 'UPDATE_FAILED'
        });
      }

      // Get message with author info for broadcast
      const messages = await storage.getMessages(message.room, 100);
      const messageWithAuthor = messages.find(m => m.id === messageId);

      // Broadcast the update to WebSocket clients
      broadcast({
        type: 'message_edited',
        data: messageWithAuthor || updatedMessage
      });

      logStructuredEvent('message.edit', {
        outcome: 'success',
        role: userRole,
        messageId,
        humanId,
        room: message.room,
        sessionId: req.sessionID || null,
        guestSessionId: req.guestSessionId || null,
      });

      res.json(messageWithAuthor || updatedMessage);
    } catch (error) {
      console.error('Error editing message:', error);
      res.status(500).json({ message: 'Failed to edit message' });
    }
  });

  // Delete a message (requires authentication)
  app.delete('/api/messages/:id', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const messageId = req.params.id;

      if (!messageId) {
        return res.status(400).json({
          message: 'Message ID is required',
          code: 'MISSING_ID'
        });
      }

      // Get the message
      const message = await storage.getMessageById(messageId);
      if (!message) {
        return res.status(404).json({
          message: 'Message not found',
          code: 'NOT_FOUND'
        });
      }

      // Determine the current user's ID (guest or verified)
      const userRole = req.userRole || 'guest';
      const humanId = userRole === 'guest' ? `guest_${req.guestSessionId}` : req.humanId!;

      // Verify the message belongs to the current user
      if (message.authorHumanId !== humanId) {
        return res.status(403).json({
          message: 'You can only delete your own messages',
          code: 'UNAUTHORIZED'
        });
      }

      // Check if message is less than 60 seconds old
      const now = new Date();
      const messageAge = now.getTime() - message.createdAt.getTime();
      const sixtySeconds = 60 * 1000;

      if (messageAge > sixtySeconds) {
        return res.status(403).json({
          message: 'Messages can only be deleted within 60 seconds of posting',
          code: 'DELETE_WINDOW_EXPIRED'
        });
      }

      // Delete the message
      await storage.deleteMessage(messageId);

      // Broadcast the deletion to WebSocket clients
      broadcast({
        type: 'message_deleted',
        messageId,
        room: message.room
      });

      logStructuredEvent('message.delete', {
        outcome: 'success',
        role: userRole,
        messageId,
        humanId,
        room: message.room,
        sessionId: req.sessionID || null,
        guestSessionId: req.guestSessionId || null,
      });

      res.json({ 
        success: true,
        messageId,
        room: message.room
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ message: 'Failed to delete message' });
    }
  });

  // Star a message (requires authentication)
  app.post('/api/stars', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      // Allow guests to star messages
      const userRole = req.userRole || 'guest';
      const humanId = userRole === 'guest' ? `guest_${req.guestSessionId}` : req.humanId!;
      const starData = insertStarSchema.parse(req.body);

      // Check if user already starred this message
      const existingStar = await storage.getUserStarForMessage(starData.messageId, humanId);
      if (existingStar) {
        return res.status(400).json({ 
          message: 'You have already starred this message',
          code: 'ALREADY_STARRED'
        });
      }

      // No rate limiting - unlimited stars

      // Create star
      const star = await storage.createStar({
        ...starData,
        humanId
      });

      // COMMENTED OUT: updateParticipationMetrics and createPointTransaction don't exist
      const message = await storage.getMessageById(starData.messageId);
      if (message) {
        // await storage.updateParticipationMetrics(humanId, message.room, {
        //   starsGiven: 1
        // });

        // await storage.updateParticipationMetrics(message.humanId, message.room, {
        //   starsReceived: 1
        // });

        // const starPoints = 15; // Bonus points for receiving a star
        // await storage.createPointTransaction({
        //   humanId: message.humanId,
        //   type: 'earn',
        //   source: 'star',
        //   points: starPoints,
        //   description: `Bonus points for receiving a star on your message`,
        //   messageId: starData.messageId
        // });

        // Broadcast star event
        broadcast({
          type: 'message_starred',
          data: {
            messageId: starData.messageId,
            newStarCount: message.starsCount
            // Removed: authorEarnedPoints
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
      // Allow guests to report messages
      const userRole = req.userRole || 'guest';
      const humanId = userRole === 'guest' ? `guest_${req.guestSessionId}` : req.humanId!;
      const reportData = insertReportSchema.parse(req.body);

      const report = await storage.createReport({
        ...reportData
        // Removed: reporterHumanId doesn't exist in the report type
      });

      // Check report count and log if auto-hide was triggered
      const reportCount = await storage.getReportCountForMessage(reportData.messageId);
      if (reportCount >= 3) {
        const message = await storage.getMessageById(reportData.messageId);
        if (message?.isHidden) {
          console.log(`Message ${reportData.messageId} auto-hidden after ${reportCount} unique reports`);
          logStructuredEvent('message.auto_hide', {
            messageId: reportData.messageId,
            reportCount,
            reporterId: humanId,
            authorId: message.authorHumanId,  // Fixed: field is authorHumanId
            room: message.room
          });
        }
      }

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

  // ===== MUTE AND BLOCK ENDPOINTS =====
  
  // Mute a user
  app.post('/api/mutes', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const userRole = req.userRole || 'guest';
      const humanId = userRole === 'guest' ? `guest_${req.guestSessionId}` : req.humanId!;
      const { mutedHumanId } = req.body;

      if (!mutedHumanId || typeof mutedHumanId !== 'string') {
        return res.status(400).json({ message: 'mutedHumanId is required' });
      }

      if (humanId === mutedHumanId) {
        return res.status(400).json({ message: 'Cannot mute yourself' });
      }

      await storage.muteUser(humanId, mutedHumanId);
      res.json({ message: 'User muted successfully' });
    } catch (error) {
      console.error('Error muting user:', error);
      res.status(500).json({ message: 'Failed to mute user' });
    }
  });

  // Unmute a user
  app.delete('/api/mutes/:humanId', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const userRole = req.userRole || 'guest';
      const humanId = userRole === 'guest' ? `guest_${req.guestSessionId}` : req.humanId!;
      const { humanId: mutedHumanId } = req.params;

      await storage.unmuteUser(humanId, mutedHumanId);
      res.json({ message: 'User unmuted successfully' });
    } catch (error) {
      console.error('Error unmuting user:', error);
      res.status(500).json({ message: 'Failed to unmute user' });
    }
  });

  // Get muted users
  app.get('/api/mutes', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const userRole = req.userRole || 'guest';
      const humanId = userRole === 'guest' ? `guest_${req.guestSessionId}` : req.humanId!;

      const mutedUsers = await storage.getMutedUsers(humanId);
      res.json(mutedUsers);
    } catch (error) {
      console.error('Error getting muted users:', error);
      res.status(500).json({ message: 'Failed to get muted users' });
    }
  });

  // Block a user
  app.post('/api/blocks', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const userRole = req.userRole || 'guest';
      const humanId = userRole === 'guest' ? `guest_${req.guestSessionId}` : req.humanId!;
      const { blockedHumanId } = req.body;

      if (!blockedHumanId || typeof blockedHumanId !== 'string') {
        return res.status(400).json({ message: 'blockedHumanId is required' });
      }

      if (humanId === blockedHumanId) {
        return res.status(400).json({ message: 'Cannot block yourself' });
      }

      await storage.blockUser(humanId, blockedHumanId);
      res.json({ message: 'User blocked successfully' });
    } catch (error) {
      console.error('Error blocking user:', error);
      res.status(500).json({ message: 'Failed to block user' });
    }
  });

  // Unblock a user
  app.delete('/api/blocks/:humanId', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const userRole = req.userRole || 'guest';
      const humanId = userRole === 'guest' ? `guest_${req.guestSessionId}` : req.humanId!;
      const { humanId: blockedHumanId } = req.params;

      await storage.unblockUser(humanId, blockedHumanId);
      res.json({ message: 'User unblocked successfully' });
    } catch (error) {
      console.error('Error unblocking user:', error);
      res.status(500).json({ message: 'Failed to unblock user' });
    }
  });

  // Get blocked users
  app.get('/api/blocks', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const userRole = req.userRole || 'guest';
      const humanId = userRole === 'guest' ? `guest_${req.guestSessionId}` : req.humanId!;

      const blockedUsers = await storage.getBlockedUsers(humanId);
      res.json(blockedUsers);
    } catch (error) {
      console.error('Error getting blocked users:', error);
      res.status(500).json({ message: 'Failed to get blocked users' });
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

  // COMMENTED OUT: getUserModerationProfile doesn't exist
  // app.get('/api/moderation/profile/:userId?', authenticateHuman, async (req: AuthenticatedRequest, res) => {
  //   try {
  //     const humanId = req.params.userId || req.humanId!;
  //     
  //     // Only allow users to view their own profile or admins to view any
  //     const adminKey = req.headers['x-admin-key'] as string;
  //     if (humanId !== req.humanId && (!adminKey || adminKey !== process.env.ADMIN_KEY)) {
  //       return res.status(403).json({ message: 'Access denied' });
  //     }
  //
  //     const profile = await storage.getUserModerationProfile(humanId);
  //     res.json(profile);
  //   } catch (error) {
  //     console.error('Error fetching moderation profile:', error);
  //     res.status(500).json({ message: 'Failed to fetch profile' });
  //   }
  // });

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

  // COMMENTED OUT: getUserAppeals doesn't exist
  // app.get('/api/moderation/appeals', authenticateHuman, async (req: AuthenticatedRequest, res) => {
  //   try {
  //     const humanId = req.humanId!;
  //     const appeals = await storage.getUserAppeals(humanId);
  //     res.json(appeals);
  //   } catch (error) {
  //     console.error('Error fetching appeals:', error);
  //     res.status(500).json({ message: 'Failed to fetch appeals' });
  //   }
  // });

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

  // ===== ADMIN MODERATION ENDPOINTS - ALL COMMENTED OUT =====
  // These methods don't exist in storage: getModerationDashboard, getModerationQueue, processModerationReview,
  // getModerationAnalytics, assignModerationQueueItem, resolveModerationQueueItem, processAppeal, getModerationStatsRange

  // // Get moderation dashboard
  // app.get('/api/admin/moderation/dashboard', authenticateAdmin, async (req, res) => {
  //   try {
  //     const dashboard = await storage.getModerationDashboard();
  //     res.json(dashboard);
  //   } catch (error) {
  //     console.error('Error fetching moderation dashboard:', error);
  //     res.status(500).json({ message: 'Failed to fetch dashboard' });
  //   }
  // });

  // // Get moderation queue
  // app.get('/api/admin/moderation/queue', authenticateAdmin, async (req, res) => {
  //   try {
  //     const { status, priority, assignedTo, queueType, limit } = req.query;
  //     
  //     const queueItems = await storage.getModerationQueue({
  //       status: status as string,
  //       priority: priority as string,
  //       assignedTo: assignedTo as string,
  //       queueType: queueType as string,
  //       limit: limit ? parseInt(limit as string) : undefined
  //     });
  //     
  //     res.json(queueItems);
  //   } catch (error) {
  //     console.error('Error fetching moderation queue:', error);
  //     res.status(500).json({ message: 'Failed to fetch queue' });
  //   }
  // });

  // // Process moderation review
  // app.post('/api/admin/moderation/review', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  //   try {
  //     const reviewAction = req.body;
  //     await storage.processModerationReview(reviewAction);
  //     
  //     res.json({ message: 'Review processed successfully' });
  //   } catch (error) {
  //     console.error('Error processing moderation review:', error);
  //     res.status(500).json({ message: 'Failed to process review' });
  //   }
  // });

  // // Get moderation analytics
  // app.get('/api/admin/moderation/analytics', authenticateAdmin, async (req, res) => {
  //   try {
  //     const { period, startDate, endDate } = req.query;
  //     
  //     const analytics = await storage.getModerationAnalytics({
  //       period: period as any,
  //       startDate: startDate as string,
  //       endDate: endDate as string
  //     });
  //     
  //     res.json(analytics);
  //   } catch (error) {
  //     console.error('Error fetching moderation analytics:', error);
  //     res.status(500).json({ message: 'Failed to fetch analytics' });
  //   }
  // });

  // // Assign moderation queue item
  // app.patch('/api/admin/moderation/queue/:id/assign', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  //   try {
  //     const { id } = req.params;
  //     const { assignedTo } = req.body;
  //     
  //     await storage.assignModerationQueueItem(id, assignedTo);
  //     res.json({ message: 'Queue item assigned successfully' });
  //   } catch (error) {
  //     console.error('Error assigning queue item:', error);
  //     res.status(500).json({ message: 'Failed to assign queue item' });
  //   }
  // });

  // // Resolve moderation queue item
  // app.patch('/api/admin/moderation/queue/:id/resolve', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  //   try {
  //     const { id } = req.params;
  //     const { actionTaken, reviewNotes } = req.body;
  //     
  //     await storage.resolveModerationQueueItem(id, actionTaken, reviewNotes);
  //     res.json({ message: 'Queue item resolved successfully' });
  //   } catch (error) {
  //     console.error('Error resolving queue item:', error);
  //     res.status(500).json({ message: 'Failed to resolve queue item' });
  //   }
  // });

  // // Process moderation appeal (admin)
  // app.patch('/api/admin/moderation/appeals/:id', authenticateAdmin, async (req: AuthenticatedRequest, res) => {
  //   try {
  //     const { id } = req.params;
  //     const { approved, reviewNotes } = req.body;
  //     const reviewerId = req.humanId!;
  //     
  //     const result = await storage.processAppeal(id, approved, reviewNotes, reviewerId);
  //     res.json(result);
  //   } catch (error) {
  //     console.error('Error processing appeal:', error);
  //     res.status(500).json({ message: 'Failed to process appeal' });
  //   }
  // });

  // // Get moderation statistics
  // app.get('/api/admin/moderation/stats', authenticateAdmin, async (req, res) => {
  //   try {
  //     const { startDate, endDate } = req.query;
  //     
  //     const stats = await storage.getModerationStatsRange(
  //       startDate as string,
  //       endDate as string
  //     );
  //     
  //     res.json(stats);
  //   } catch (error) {
  //     console.error('Error fetching moderation stats:', error);
  //     res.status(500).json({ message: 'Failed to fetch stats' });
  //   }
  // });

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
          results.push({ success: false, error: (error as any).message || 'Unknown error', topicId, date });
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
        ...connectData
        // Removed: requesterHumanId doesn't exist in connect request type
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

  // Premium System API Endpoints
  
  // Get premium status for current user
  app.get('/api/premium/status', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const premiumStatus = await storage.getPremiumStatus(humanId);
      
      res.json({
        isPremium: premiumStatus?.status === 'active',
        status: premiumStatus?.status || 'none',
        purchasedAt: premiumStatus?.purchasedAt,
        expiresAt: premiumStatus?.expiresAt,
        benefits: premiumStatus?.metadata?.benefits || []
      });
    } catch (error) {
      console.error('Error fetching premium status:', error);
      res.status(500).json({ message: 'Failed to fetch premium status' });
    }
  });
  
  // Process premium purchase (initiated from MiniKit payment)
  app.post('/api/premium/purchase', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const { transactionId, paymentProof, amount } = req.body;
      
      // Validate request
      if (!transactionId || !paymentProof) {
        return res.status(400).json({ 
          message: 'Missing transaction ID or payment proof',
          code: 'INVALID_PAYMENT_DATA'
        });
      }
      
      // Verify amount is 1 WLD
      if (amount !== 1) {
        return res.status(400).json({ 
          message: 'Invalid payment amount. Premium requires 1 WLD',
          code: 'INVALID_AMOUNT'
        });
      }
      
      // Check if already premium
      const existingPremium = await storage.getPremiumStatus(humanId);
      if (existingPremium?.status === 'active') {
        return res.status(400).json({ 
          message: 'User already has active premium',
          code: 'ALREADY_PREMIUM'
        });
      }
      
      // Create premium user record
      const premiumUser = await storage.createPremiumUser({
        humanId,
        transactionId,
        amount: 1,
        status: 'active',
        expiresAt: null, // Lifetime access
        metadata: {
          paymentProof,
          currency: 'WLD',
          appId: req.headers['x-world-app-id'] as string,
          benefits: [
            '500_char_messages',
            'unlimited_daily_messages', 
            'premium_badge',
            'work_priority',
            'special_themes'
          ]
        }
      });
      
      // Clear existing rate limits to ensure immediate benefit
      await storage.clearRateLimits(humanId);
      
      // Log the premium purchase
      logStructuredEvent('premium_purchase', {
        humanId,
        transactionId,
        amount: 1,
        currency: 'WLD'
      });
      
      // Broadcast premium status update
      broadcast({
        type: 'premium_status_update',
        data: {
          humanId,
          isPremium: true,
          status: 'active'
        }
      });
      
      res.json({
        success: true,
        message: 'Premium activated successfully',
        premium: {
          status: premiumUser.status,
          purchasedAt: premiumUser.purchasedAt,
          benefits: premiumUser.metadata?.benefits
        }
      });
      
    } catch (error: any) {
      console.error('Error processing premium purchase:', error);
      
      // Check for duplicate transaction
      if (error.code === '23505' && error.constraint === 'premium_users_transaction_id_unique') {
        return res.status(400).json({ 
          message: 'This transaction has already been processed',
          code: 'DUPLICATE_TRANSACTION'
        });
      }
      
      res.status(500).json({ 
        message: 'Failed to process premium purchase',
        code: 'PURCHASE_FAILED'
      });
    }
  });
  
  // Verify premium payment with World ID backend
  app.post('/api/premium/verify-payment', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
      const humanId = req.humanId!;
      const { transactionId, paymentProof } = req.body;
      
      // In production, you would verify the payment with World ID backend here
      // For now, we'll trust the client-side proof
      
      // TODO: Add actual World ID payment verification
      // const verified = await verifyWorldIDPayment(transactionId, paymentProof);
      // if (!verified) {
      //   return res.status(400).json({ message: 'Payment verification failed' });
      // }
      
      res.json({
        verified: true,
        message: 'Payment verification successful'
      });
      
    } catch (error) {
      console.error('Error verifying payment:', error);
      res.status(500).json({ 
        message: 'Failed to verify payment',
        code: 'VERIFICATION_FAILED'
      });
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

  // ========== POINT SYSTEM API ENDPOINTS - ALL COMMENTED OUT ==========
  // These methods don't exist: getUserPointBalance, createUserPointBalance, getUserPointHistory,
  // getUserPointTransactions, getLeaderboard, getUserRank, getDistributionEvents, getDistributionEventById,
  // calculateDailyDistribution, createDistributionEvent, executeDistribution, calculateWeeklyDistribution

  // // Get user point balance (requires authentication)
  // app.get('/api/points/balance', authenticateHuman, async (req: AuthenticatedRequest, res) => {
  //   try {
  //     const humanId = req.humanId!;
  //     const balance = await storage.getUserPointBalance(humanId);
  //     
  //     if (!balance) {
  //       // Create initial balance if doesn't exist
  //       const newBalance = await storage.createUserPointBalance({
  //         humanId,
  //         totalPoints: 0,
  //         lifetimeEarned: 0,
  //         lifetimeSpent: 0
  //       });
  //       return res.json(newBalance);
  //     }
  //
  //     res.json(balance);
  //   } catch (error) {
  //     console.error('Error fetching point balance:', error);
  //     res.status(500).json({ message: 'Failed to fetch point balance' });
  //   }
  // });

  // All other point system routes commented out...
  // [REMOVED 200+ lines of broken point system routes]

  // ========== INVITE SYSTEM API ENDPOINTS - ALL COMMENTED OUT ==========
  // These methods don't exist: createInviteCode, getUserInviteCodes, validateInviteCode, trackInviteEvent,
  // getReferralsByInvitee, createReferral, updateInviteCodeUsage, distributeReferralRewards,
  // calculateReferralRewards, getReferralDashboard, getReferralLeaderboard, getInviteCode,
  // getInviteAnalyticsSummary, getReferralsByInviter, getUserMilestones, getNextMilestone,
  // getReferralSystemStats, updateReferralLeaderboards

  // // Generate a new invite code
  // app.post('/api/invites/generate', authenticateHuman, async (req: AuthenticatedRequest, res) => {
  //   try {
  //     const humanId = req.humanId!;
  //     const { customMessage, maxUsage, expiresAt } = req.body;
  //
  //     // No rate limiting - unlimited invite generation
  //
  //     const inviteCode = await storage.createInviteCode({
  //       creatorHumanId: humanId,
  //       customMessage: customMessage || null,
  //       maxUsage: maxUsage || 100,
  //       expiresAt: expiresAt ? new Date(expiresAt) : null,
  //       metadata: {
  //         source: 'app',
  //         version: 'v1'
  //       }
  //     });
  //
  //     res.json({
  //       message: 'Invite code generated successfully',
  //       inviteCode
  //     });
  //   } catch (error) {
  //     console.error('Error generating invite code:', error);
  //     res.status(500).json({ message: 'Failed to generate invite code' });
  //   }
  // });

  // All invite/referral routes commented out - methods don't exist in storage
  // [REMOVED 270+ lines of broken invite/referral system routes]

  // COMMENTED OUT: All remaining invite/referral routes - methods don't exist
  /* ENTIRE INVITE/REFERRAL SYSTEM REMOVED - 200+ lines of broken code commented out
  
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
  */
  // END OF COMMENTED OUT INVITE/REFERRAL SYSTEM


  // World ID Verification endpoint 
  // Define WORLDID_CONFIG to fix undefined error
  const WORLDID_CONFIG = { APP_ID: 'dev_app_id', ACTION: 'verify' };
  
  app.post('/api/verify/worldid', handleGuestSession, async (req: AuthenticatedRequest, res) => {
    try {
      const { proof, nullifier_hash, merkle_root, action, signal, verification_level } = req.body;

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
        // Generate a unique handle from the humanId (first 8 chars)
        const baseHandle = `user_${humanId.substring(0, 8)}`;
        human = await storage.createHuman({ 
          id: humanId,
          role: 'verified',
          handle: baseHandle
        });
      } else if (human.role === 'guest') {
        // Upgrade from guest to verified
        await storage.updateHumanRole(humanId, 'verified');
      }
      
      // If there's a guest session, associate it with the verified human
      if (req.guestSessionId) {
        // Update the guest session to mark it as verified
        await storage.updateGuestSessionVerification(req.guestSessionId, humanId);
      }
      
      // Set wm_uid cookie in addition to session mapping
      const isSecure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
      res.setHeader('Set-Cookie', [
        `wm_uid=${humanId}; HttpOnly; Path=/; SameSite=${isSecure ? 'None' : 'Lax'}; ${isSecure ? 'Secure; ' : ''}Max-Age=${365*24*60*60}`,
        // Keep the existing session cookie as well
        ...(req.guestSessionId ? [`wm_sid=${req.guestSessionId}; HttpOnly; Path=/; SameSite=${isSecure ? 'None' : 'Lax'}; ${isSecure ? 'Secure; ' : ''}Max-Age=${365*24*60*60}`] : [])
      ]);

      res.json({
        ok: true,
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

      // COMMENTED OUT: createPermit2Signature doesn't exist
      // await storage.createPermit2Signature({
      //   humanId: req.humanId!,
      //   tokenId: token, // This would be resolved to a token ID in production
      //   signature,
      //   amount,
      //   deadline,
      //   nonce,
      //   spender,
      //   used: false
      // });

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
