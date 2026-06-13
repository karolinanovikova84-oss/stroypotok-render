import type { NextFunction, Request, Response } from "express";

import { verifyAccessToken } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required"
    });
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = verifyAccessToken(token);

    req.auth = {
      userId: payload.userId,
      role: payload.role
    };

    return next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token"
    });
  }
}

export function requireRoles(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({
        error: "Authentication required"
      });
    }

    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    return next();
  };
}
