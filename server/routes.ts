import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertMessageSchema, 
  insertStarSchema, 
  insertReportSchema,
  insertConnectRequestSchema,
  type MessageWithAuthor 
} from "@shared/schema";
import crypto from "crypto";

// Rate limit constants
const RATE_LIMITS = {
  MESSAGES_PER_MIN: parseInt(process.env.RATE_LIMIT_MESSAGES_PER_MIN || '5'),
  MESSAGES_PER_HOUR: parseInt(process.env.RATE_LIMIT_MESSAGES_PER_HOUR || '60'),
  MESSAGES_PER_DAY: parseInt(process.env.RATE_LIMIT_MESSAGES_PER_DAY || '200'),
  STARS_PER_MIN: parseInt(process.env.RATE_LIMIT_STARS_PER_MIN || '20'),
  WORK_LINKS_PER_10MIN: parseInt(process.env.RATE_LIMIT_WORK_LINKS_PER_10MIN || '2'),
  WORK_LINKS_PER_HOUR: parseInt(process.env.RATE_LIMIT_WORK_LINKS_PER_HOUR || '4'),
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

  // Middleware to extract and verify human ID from World ID nullifier
  const authenticateHuman = async (req: AuthenticatedRequest, res: Response, next: any) => {
    const worldIdProof = req.headers['x-world-id-proof'] as string;
    
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
        human = await storage.createHuman({ id: humanId });
      }

      // Update presence
      await storage.updatePresence(humanId);
      
      req.humanId = humanId;
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
      const humanId = req.humanId!;
      const messageData = insertMessageSchema.parse(req.body);

      // Content filtering
      const contentCheck = filterContent(messageData.text);
      if (!contentCheck.isValid) {
        return res.status(400).json({ 
          message: contentCheck.reason,
          code: 'CONTENT_FILTERED'
        });
      }

      // Rate limiting
      const rateLimitAction = messageData.link ? 'work_link' : 'message';
      const rateCheck = await checkRateLimit(humanId, rateLimitAction);
      if (!rateCheck.allowed) {
        return res.status(429).json({
          message: `You're sending messages fast. Take a breath—back in ${rateCheck.cooldownSeconds} sec.`,
          code: 'RATE_LIMITED',
          cooldownSeconds: rateCheck.cooldownSeconds
        });
      }

      // Create message
      const message = await storage.createMessage({
        ...messageData,
        authorHumanId: humanId
      });

      // Update rate limits
      await storage.incrementRateLimit(humanId, 'message', 'minute');
      await storage.incrementRateLimit(humanId, 'message', 'hour');
      await storage.incrementRateLimit(humanId, 'message', 'day');

      if (messageData.link) {
        await storage.incrementRateLimit(humanId, 'work_link', 'minute');
        await storage.incrementRateLimit(humanId, 'work_link', 'hour');
      }

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

      console.log(`Message sent: ${humanId} -> ${message.room}`);
      res.json(messageWithAuthor);
    } catch (error) {
      console.error('Error sending message:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // Star a message (requires authentication)
  app.post('/api/stars', authenticateHuman, async (req: AuthenticatedRequest, res) => {
    try {
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

      // Get updated message for broadcast
      const message = await storage.getMessageById(starData.messageId);
      if (message) {
        broadcast({
          type: 'message_starred',
          data: {
            messageId: starData.messageId,
            newStarCount: message.starsCount
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
      const humanId = req.humanId!;
      const reportData = insertReportSchema.parse(req.body);

      const report = await storage.createReport({
        ...reportData,
        reporterHumanId: humanId
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

  // Get today's theme/topic
  app.get('/api/theme', async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      let theme = await storage.getThemeForDate(today);
      
      if (!theme) {
        theme = await storage.createTheme({
          date: today,
          topicText: "What are you building today?"
        });
      }

      res.json(theme);
    } catch (error) {
      console.error('Error fetching theme:', error);
      res.status(500).json({ message: 'Failed to fetch theme' });
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

  return httpServer;
}
