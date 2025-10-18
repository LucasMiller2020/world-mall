import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { TopicRotationScheduler } from "./topic-scheduler";
import { db } from "./db";
import { humans } from "@shared/schema";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS configuration for World Mini App compatibility
const isProduction = process.env.NODE_ENV === 'production';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (!isProduction) return callback(null, true);
    
    // In production, allow World App and Replit domains
    const allowedOrigins = [
      /\.worldcoin\.org$/,
      /\.world\.org$/,
      /\.replit\.app$/,
      /\.replit\.dev$/,
      'https://worldcoin.org',
      'https://world.org'
    ];
    
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === 'string') {
        return origin === pattern;
      }
      return pattern.test(origin);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      log(`CORS: Blocked origin ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies and session data
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Configure express-session for WebView compatibility
// (isProduction already defined above for CORS config)

// Configure session store based on environment
const sessionConfig: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || 'world-mall-dev-secret-' + Math.random().toString(36),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction, // Secure in production (HTTPS)
    sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin WebView in production
    maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
  },
  name: 'wm_sid' // World Mall session ID
};

// Use PostgreSQL session store in production for better scalability
if (isProduction && process.env.DATABASE_URL) {
  const PgSession = connectPgSimple(session);
  sessionConfig.store = new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true,
    pruneSessionInterval: 60 * 60 // Prune expired sessions every hour
  });
  log('Using PostgreSQL session store for production');
} else {
  log('Using in-memory session store for development');
}

app.use(session(sessionConfig));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Production startup - check World ID configuration
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.WORLD_ID_APP_ID || !process.env.WORLD_ID_ACTION) {
      log('WARNING: WORLD_ID_APP_ID and WORLD_ID_ACTION are not configured');
      log('The app will run in guest-only mode without World ID verification');
    } else {
      log('Production environment: World ID configuration verified');
    }
  }
  
  const server = await registerRoutes(app);
  
  // Database smoke test - verify connection on startup
  try {
    log('Running database smoke test...');
    await db.select().from(humans).limit(1);
    log('Database connection verified successfully');
  } catch (error) {
    log(`Database smoke test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }

  // Initialize topic rotation scheduler
  const topicScheduler = new TopicRotationScheduler();
  await topicScheduler.start();
  log('Topic rotation scheduler started');
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    log('SIGTERM received, shutting down gracefully');
    await topicScheduler.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    log('SIGINT received, shutting down gracefully');
    await topicScheduler.stop();
    process.exit(0);
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
