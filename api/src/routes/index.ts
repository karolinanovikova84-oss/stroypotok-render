import { Router } from "express";

import { assignmentsRouter } from "./assignments";
import { absencesRouter } from "./absences";
import { authRouter } from "./auth";
import { payrollRouter } from "./payroll";
import { projectsRouter } from "./projects";
import { requestsRouter } from "./requests";
import { resourcesRouter } from "./resources";
import { shiftsRouter } from "./shifts";
import { timeRouter } from "./time";
import { usersRouter } from "./users";

export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.status(200).json({
    name: "Construction Workforce API",
    version: "0.1.0",
    resources: {
      auth: "/api/auth",
      projects: "/api/projects",
      absences: "/api/absences",
      payroll: "/api/payroll",
      requests: "/api/requests",
      resources: "/api/resources",
      shifts: "/api/shifts",
      users: "/api/users",
      assignments: "/api/assignments",
      time: "/api/time"
    }
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/absences", absencesRouter);
apiRouter.use("/requests", requestsRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/payroll", payrollRouter);
apiRouter.use("/resources", resourcesRouter);
apiRouter.use("/shifts", shiftsRouter);
apiRouter.use("/time", timeRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/assignments", assignmentsRouter);
