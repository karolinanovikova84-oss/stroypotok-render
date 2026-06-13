import { ProjectStatus, RequestPriority, RequestStatus, UserRole } from "@prisma/client";
import { Router } from "express";

import { parseOptionalDate, sendBadRequest } from "../lib/http";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRoles } from "../middleware/auth";

export const requestsRouter = Router();

requestsRouter.use(requireAuth);

function requestScope(userId: string, role: string) {
  if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) {
    return {};
  }

  if (role === UserRole.MANAGER) {
    return {
      project: {
        managerId: userId
      }
    };
  }

  return {
    clientId: userId
  };
}

const requestInclude = {
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true
    }
  },
  project: {
    select: {
      id: true,
      title: true,
      status: true,
      managerId: true
    }
  }
};

requestsRouter.get("/", async (req, res) => {
  const requests = await prisma.clientRequest.findMany({
    where: requestScope(req.auth!.userId, req.auth!.role),
    orderBy: {
      createdAt: "desc"
    },
    include: requestInclude
  });

  res.status(200).json(requests);
});

requestsRouter.post("/", async (req, res) => {
  const {
    title,
    description,
    address,
    clientName,
    clientPhone,
    clientEmail,
    desiredStartDate,
    desiredEndDate,
    budget,
    priority,
    notes
  } = req.body;

  if (!title || typeof title !== "string") {
    return sendBadRequest(res, "title is required");
  }

  if (!description || typeof description !== "string") {
    return sendBadRequest(res, "description is required");
  }

  if (!address || typeof address !== "string") {
    return sendBadRequest(res, "address is required");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: req.auth!.userId
    }
  });

  const parsedStart = parseOptionalDate(desiredStartDate);
  const parsedEnd = parseOptionalDate(desiredEndDate);

  if (desiredStartDate && !parsedStart) {
    return sendBadRequest(res, "invalid desiredStartDate");
  }

  if (desiredEndDate && !parsedEnd) {
    return sendBadRequest(res, "invalid desiredEndDate");
  }

  if (parsedStart && parsedEnd && parsedEnd < parsedStart) {
    return sendBadRequest(res, "desiredEndDate must be greater than desiredStartDate");
  }

  if (priority && !Object.values(RequestPriority).includes(priority)) {
    return sendBadRequest(res, "invalid priority");
  }

  const request = await prisma.clientRequest.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      address: address.trim(),
      clientName:
        typeof clientName === "string" && clientName.trim()
          ? clientName.trim()
          : `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Клиент",
      clientPhone:
        typeof clientPhone === "string" && clientPhone.trim()
          ? clientPhone.trim()
          : user?.phone || "",
      clientEmail:
        typeof clientEmail === "string" && clientEmail.trim()
          ? clientEmail.trim().toLowerCase()
          : user?.email || null,
      desiredStartDate: parsedStart,
      desiredEndDate: parsedEnd,
      budget: budget !== undefined && budget !== "" ? Number(budget) : null,
      priority: priority || RequestPriority.NORMAL,
      notes: typeof notes === "string" ? notes.trim() || null : null,
      clientId: req.auth!.role === UserRole.CLIENT ? req.auth!.userId : null
    },
    include: requestInclude
  });

  res.status(201).json(request);
});

requestsRouter.patch(
  "/:id",
  requireRoles([UserRole.ADMIN, UserRole.COORDINATOR]),
  async (req, res) => {
    const requestId = String(req.params.id);
    const { status, priority, notes } = req.body;

    if (status && !Object.values(RequestStatus).includes(status)) {
      return sendBadRequest(res, "invalid status");
    }

    if (priority && !Object.values(RequestPriority).includes(priority)) {
      return sendBadRequest(res, "invalid priority");
    }

    const request = await prisma.clientRequest.update({
      where: {
        id: requestId
      },
      data: {
        status: status || undefined,
        priority: priority || undefined,
        notes: typeof notes === "string" ? notes.trim() || null : undefined
      },
      include: requestInclude
    });

    res.status(200).json(request);
  }
);

requestsRouter.delete(
  "/:id",
  requireRoles([UserRole.ADMIN, UserRole.COORDINATOR]),
  async (req, res) => {
    const requestId = String(req.params.id);

    const deleted = await prisma.$transaction(async (tx) => {
      const request = await tx.clientRequest.findUnique({
        where: {
          id: requestId
        },
        include: {
          project: {
            select: {
              id: true
            }
          }
        }
      });

      if (!request) {
        return null;
      }

      if (request.project) {
        await tx.shiftAssignment.deleteMany({
          where: {
            shift: {
              projectId: request.project.id
            }
          }
        });

        await tx.shift.deleteMany({
          where: {
            projectId: request.project.id
          }
        });

        await tx.resourceNeed.deleteMany({
          where: {
            projectId: request.project.id
          }
        });

        await tx.project.delete({
          where: {
            id: request.project.id
          }
        });
      }

      await tx.clientRequest.delete({
        where: {
          id: request.id
        }
      });

      return request;
    });

    if (!deleted) {
      return res.status(404).json({
        error: "Request not found"
      });
    }

    return res.status(204).send();
  }
);

requestsRouter.post(
  "/:id/convert",
  requireRoles([UserRole.ADMIN, UserRole.COORDINATOR]),
  async (req, res) => {
    const requestId = String(req.params.id);
    const { managerId, workStage, plannedWorkers, estimatedBudget } = req.body;

    const request = await prisma.clientRequest.findUnique({
      where: {
        id: requestId
      },
      include: {
        project: true
      }
    });

    if (!request) {
      return res.status(404).json({
        error: "Request not found"
      });
    }

    if (request.project) {
      return res.status(400).json({
        error: "Request is already converted"
      });
    }

    if (managerId) {
      const manager = await prisma.user.findFirst({
        where: {
          id: managerId,
          role: UserRole.MANAGER
        }
      });

      if (!manager) {
        return res.status(404).json({
          error: "Manager not found"
        });
      }
    }

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          title: request.title,
          description: request.description,
          address: request.address,
          status: ProjectStatus.DRAFT,
          clientName: request.clientName,
          clientPhone: request.clientPhone,
          startDate: request.desiredStartDate,
          endDate: request.desiredEndDate,
          managerId: typeof managerId === "string" ? managerId : null,
          clientId: request.clientId,
          requestId: request.id,
          workStage: typeof workStage === "string" ? workStage.trim() || null : "Ожидает план прораба",
          plannedWorkers:
            Number.isInteger(plannedWorkers) && plannedWorkers > 0 ? plannedWorkers : null,
          estimatedBudget:
            estimatedBudget !== undefined && estimatedBudget !== "" ? Number(estimatedBudget) : request.budget
        }
      });

      await tx.clientRequest.update({
        where: {
          id: request.id
        },
        data: {
          status: RequestStatus.CONVERTED
        }
      });

      return createdProject;
    });

    const result = await prisma.project.findUnique({
      where: {
        id: project.id
      },
      include: {
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        resources: true,
        request: true,
        _count: {
          select: {
            shifts: true,
            resources: true
          }
        }
      }
    });

    res.status(201).json(result);
  }
);
