import { UserRole } from "@prisma/client";
import { Router } from "express";

import { getDemoNow, resetDemoNow, setDemoNow } from "../lib/demo-time";
import { sendBadRequest } from "../lib/http";
import { requireAuth, requireRoles } from "../middleware/auth";

export const timeRouter = Router();

timeRouter.use(requireAuth);

timeRouter.get("/", async (_req, res) => {
  const now = await getDemoNow();

  return res.status(200).json({
    now: now.toISOString()
  });
});

timeRouter.patch(
  "/",
  requireRoles([UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MANAGER]),
  async (req, res) => {
    const { now, reset } = req.body as { now?: string; reset?: boolean };

    if (reset) {
      await resetDemoNow();
      const current = await getDemoNow();
      return res.status(200).json({
        now: current.toISOString()
      });
    }

    const parsed = new Date(String(now || ""));
    if (Number.isNaN(parsed.getTime())) {
      return sendBadRequest(res, "valid demo date is required");
    }

    await setDemoNow(parsed);

    return res.status(200).json({
      now: parsed.toISOString()
    });
  }
);
