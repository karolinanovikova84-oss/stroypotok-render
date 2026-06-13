import type { Response } from "express";

export function sendBadRequest(res: Response, message: string) {
  return res.status(400).json({
    error: message
  });
}

export function parseOptionalDate(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseRequiredDate(value: unknown) {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}
