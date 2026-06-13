import cors from "cors";
import express from "express";

import { apiRouter } from "./routes";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.status(200).json({
      name: "Construction Workforce API",
      version: "0.1.0",
      docs: {
        health: "/health",
        api: "/api",
        projects: "/api/projects",
        shifts: "/api/shifts"
      }
    });
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString()
    });
  });

  app.use("/api", apiRouter);

  return app;
}
