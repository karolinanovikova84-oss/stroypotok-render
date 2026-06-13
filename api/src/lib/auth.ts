import jwt from "jsonwebtoken";

import type { AuthPayload } from "../types/auth";

const AUTH_SECRET = process.env.AUTH_SECRET || "change-me-for-production";

export function signAccessToken(payload: AuthPayload) {
  return jwt.sign(payload, AUTH_SECRET, {
    expiresIn: "7d"
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, AUTH_SECRET) as AuthPayload;
}
