import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";

import { setupVite, serveStatic, log } from "./vite";
import { registerRoutes } from "./routes";
import { validateEnvironmentOrExit } from "./utils/envValidation";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Headers for iframe embedding (Wix compatibility)
app.use((req, res, next) => {
  // Allow the app to be embedded in iframes from any origin
  res.removeHeader('X-Frame-Options');
  
  // Set CORS headers to allow embedding
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

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
  // Validate environment variables at startup
  validateEnvironmentOrExit();
  
  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Create a properly formatted error response that the frontend can handle
    res.status(200).json({
      error: true,
      errorMessage: message,
      formattedReport: `**Analysis Error**\n\nWe encountered an issue with the AI service: ${message}\n\nPlease try again or select a different AI provider.`,
      provider: "AI Service (Error)",
      overallScore: 0,
      surface: { grammar: 0, structure: 0, jargonUsage: 0, surfaceFluency: 0 },
      deep: { conceptualDepth: 0, inferentialContinuity: 0, semanticCompression: 0, logicalLaddering: 0, originality: 0 }
    });
    
    // Log the error but don't throw it to prevent crashing the server
    console.error("Server error:", err);
  });

  // Create HTTP server
  const server = createServer(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
