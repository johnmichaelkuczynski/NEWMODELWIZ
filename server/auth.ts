import type { Express, Request } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy, type Profile } from "passport-google-oauth20";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import type { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

function callbackUrl(req: Request) {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0];
  const protocol = forwardedProto || req.protocol;
  return `${protocol}://${req.get("host")}/api/auth/google/callback`;
}

async function findOrCreateGoogleUser(profile: Profile) {
  const username = `google_${profile.id}`;
  const existingUser = await storage.getUserByUsername(username);
  if (existingUser) return existingUser;

  return storage.createUser({
    username,
    password: randomBytes(32).toString("hex"),
    email: profile.emails?.[0]?.value || null,
  });
}

async function findOrCreateDevelopmentUser() {
  const username = "dev_johnmichaelkuczynski";
  const existingUser = await storage.getUserByUsername(username);
  if (existingUser) return existingUser;

  return storage.createUser({
    username,
    password: randomBytes(32).toString("hex"),
    email: "johnmichaelkuczynski@gmail.com",
  });
}

export function setupAuth(app: Express) {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!clientID || !clientSecret || !sessionSecret) {
    throw new Error("Google login requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and SESSION_SECRET");
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

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: "/api/auth/google/callback",
        proxy: true,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          done(null, await findOrCreateGoogleUser(profile));
        } catch (error) {
          done(error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      done(null, await storage.getUser(id));
    } catch (error) {
      done(error);
    }
  });

  app.get("/api/auth/google", (req, res, next) => {
    passport.authenticate("google", {
      scope: ["profile", "email"],
      callbackURL: callbackUrl(req),
    } as any)(req, res, next);
  });

  app.get("/api/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", {
      failureRedirect: "/?auth=failed",
      callbackURL: callbackUrl(req),
    } as any)(req, res, () => res.redirect("/?auth=success"));
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) return res.json(null);
    const { password: _password, ...safeUser } = req.user;
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