import { ProjectWorkflowStatus, ResourceStatus, UserRole } from "@prisma/client";
import { Router } from "express";

import { parseOptionalDate, sendBadRequest } from "../lib/http";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRoles } from "../middleware/auth";

export const resourcesRouter = Router();

resourcesRouter.use(requireAuth);

async function canAccessProject(userId: string, role: string, projectId: string) {
  if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) {
    return true;
  }

  const project = await prisma.project.findUnique({
    where: {
      id: projectId
    },
    select: {
      managerId: true,
      clientId: true
    }
  });

  if (!project) {
    return false;
  }

  if (role === UserRole.MANAGER) {
    return project.managerId === userId;
  }

  if (role === UserRole.CLIENT) {
    return project.clientId === userId;
  }

  return false;
}

resourcesRouter.get("/", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;

  if (!projectId) {
    return sendBadRequest(res, "projectId is required");
  }

  if (!(await canAccessProject(req.auth!.userId, req.auth!.role, projectId))) {
    return res.status(403).json({
      error: "Access denied"
    });
  }

  const resources = await prisma.resourceNeed.findMany({
    where: {
      projectId
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  res.status(200).json(resources);
});

resourcesRouter.post(
  "/",
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  async (req, res) => {
    const { projectId, title, category, quantity, unit, status, supplier, estimatedCost, dueDate, notes } = req.body;

    if (!projectId || typeof projectId !== "string") {
      return sendBadRequest(res, "projectId is required");
    }

    if (!(await canAccessProject(req.auth!.userId, req.auth!.role, projectId))) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    if (!title || typeof title !== "string") {
      return sendBadRequest(res, "title is required");
    }

    if (!category || typeof category !== "string") {
      return sendBadRequest(res, "category is required");
    }

    const parsedQuantity = Number(quantity);
    if (Number.isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return sendBadRequest(res, "quantity must be a positive number");
    }

    if (status && !Object.values(ResourceStatus).includes(status)) {
      return sendBadRequest(res, "invalid resource status");
    }

    const parsedDueDate = parseOptionalDate(dueDate);
    if (dueDate && !parsedDueDate) {
      return sendBadRequest(res, "invalid dueDate");
    }

    const resource = await prisma.resourceNeed.create({
      data: {
        projectId,
        title: title.trim(),
        category: category.trim(),
        quantity: parsedQuantity,
        unit: typeof unit === "string" && unit.trim() ? unit.trim() : "шт.",
        status: status || ResourceStatus.NEEDED,
        supplier: typeof supplier === "string" ? supplier.trim() || null : null,
        estimatedCost:
          estimatedCost !== undefined && estimatedCost !== "" ? Number(estimatedCost) : null,
        dueDate: parsedDueDate,
        notes: typeof notes === "string" ? notes.trim() || null : null
      }
    });

    await prisma.project.update({
      where: {
        id: projectId
      },
      data: {
        workflowStatus: ProjectWorkflowStatus.PLANNING,
        resourcesRequestedAt: new Date(),
        workStage: "Прораб формирует ресурсный план"
      }
    });

    res.status(201).json(resource);
  }
);

resourcesRouter.patch(
  "/:id",
  requireRoles([UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MANAGER]),
  async (req, res) => {
    const resourceId = String(req.params.id);
    const current = await prisma.resourceNeed.findUnique({
      where: {
        id: resourceId
      }
    });

    if (!current) {
      return res.status(404).json({
        error: "Resource not found"
      });
    }

    if (!(await canAccessProject(req.auth!.userId, req.auth!.role, current.projectId))) {
      return res.status(403).json({
        error: "Access denied"
      });
    }

    const { status, supplier, estimatedCost, dueDate, notes } = req.body;

    if (status && !Object.values(ResourceStatus).includes(status)) {
      return sendBadRequest(res, "invalid resource status");
    }

    const parsedDueDate = parseOptionalDate(dueDate);
    if (dueDate && !parsedDueDate) {
      return sendBadRequest(res, "invalid dueDate");
    }

    const resource = await prisma.resourceNeed.update({
      where: {
        id: current.id
      },
      data: {
        status: status || undefined,
        supplier: typeof supplier === "string" ? supplier.trim() || null : undefined,
        estimatedCost:
          estimatedCost !== undefined && estimatedCost !== "" ? Number(estimatedCost) : undefined,
        dueDate: dueDate !== undefined ? parsedDueDate : undefined,
        notes: typeof notes === "string" ? notes.trim() || null : undefined
      }
    });

    const resources = await prisma.resourceNeed.findMany({
      where: {
        projectId: current.projectId
      }
    });

    const allReady =
      resources.length > 0 &&
      resources.every((item) =>
        item.status === ResourceStatus.RESERVED || item.status === ResourceStatus.DELIVERED
      );

    if (allReady) {
      await prisma.project.update({
        where: {
          id: current.projectId
        },
        data: {
          resourcesReadyAt: new Date(),
          workStage: "Ресурсы готовы к началу работ"
        }
      });
    } else if (req.auth!.role === UserRole.COORDINATOR && status) {
      await prisma.project.update({
        where: {
          id: current.projectId
        },
        data: {
          workStage: "Координатор обрабатывает ресурсный запрос"
        }
      });
    }

    res.status(200).json(resource);
  }
);
