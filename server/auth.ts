import type { Express } from "express";
import session from "express-session";
import passport from "passport";
import { randomBytes, randomUUID } from "crypto";
import { storage } from "./storage";
import type { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

async function findOrCreateDevelopmentUser() {
  const username = "dev_johnmichaelkuczynski";
  const existingUser = await storage.getUserByUsername(username);
  if (existingUser) return existingUser;

  return storage.createUser({
    username,
    password: randomBytes(32).toString("hex"),
    email: null,
  });
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error("Sessions require SESSION_SECRET");
  }

  app.set("trust proxy", 1);
  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: storage.sessionStore,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: app.get("env") === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  if (app.get("env") === "development") {
    app.use(async (req, _res, next) => {
      try {
        req.user = await findOrCreateDevelopmentUser();
        next();
      } catch (error) {
        next(error);
      }
    });
  }

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      done(null, await storage.getUser(id));
    } catch (error) {
      done(error);
    }
  });

  // Give each anonymous writing session its own database owner. This permits
  // long-running jobs without exposing one visitor's saved work to another.
  app.use(async (req, _res, next) => {
    if (req.user || !/^\/api\/(?:writing(?:-v2)?\/jobs|coherence-analysis-jobs)(?:\/|$)/.test(req.path)) {
      return next();
    }
    try {
      const guestSession = req.session as session.Session & { guestUserId?: number };
      let guest = guestSession.guestUserId
        ? await storage.getUser(guestSession.guestUserId)
        : undefined;
      if (!guest) {
        guest = await storage.createUser({
          username: `guest_${randomUUID()}`,
          password: randomBytes(32).toString("hex"),
          email: null,
        });
        guestSession.guestUserId = guest.id;
      }
      req.user = guest;
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get(["/api/auth/google", "/api/auth/google/callback"], (_req, res) => {
    res.status(410).json({ message: "Google sign-in is no longer available." });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.json(null);
    const {
      password: _password,
      stripeCustomerId: _stripeCustomerId,
      stripeSubscriptionId: _stripeSubscriptionId,
      ...safeUser
    } = req.user;
    res.json(safeUser);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((error) => {
      if (error) return next(error);
      req.session.destroy((sessionError) => {
        if (sessionError) return next(sessionError);
        res.clearCookie("connect.sid");
        res.sendStatus(204);
      });
    });
  });
}
