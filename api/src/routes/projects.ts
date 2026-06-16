import { ProjectStatus, ProjectWorkflowStatus, RequestStatus, ShiftAssignmentStatus, ShiftKind, ShiftStatus, UserRole } from "@prisma/client";
import { Router } from "express";

import { getDemoNow } from "../lib/demo-time";
import { sendBadRequest, parseOptionalDate } from "../lib/http";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRoles } from "../middleware/auth";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);

function projectScope(userId: string, role: string) {
  if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) {
    return {};
  }

  if (role === UserRole.MANAGER) {
    return {
      managerId: userId
    };
  }

  if (role === UserRole.CLIENT) {
    return {
      clientId: userId
    };
  }

  return {
    shifts: {
      some: {
        status: {
          not: ShiftStatus.CANCELLED
        },
        assignments: {
          some: {
            workerId: userId,
            status: {
              notIn: [ShiftAssignmentStatus.CANCELLED, ShiftAssignmentStatus.REJECTED]
            }
          }
        }
      }
    }
  };
}

const projectInclude = {
  manager: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      role: true
    }
  },
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true
    }
  },
  request: {
    select: {
      id: true,
      title: true,
      status: true,
      priority: true
    }
  },
  resources: {
    orderBy: {
      createdAt: "desc" as const
    }
  },
  shifts: {
    orderBy: {
      startsAt: "asc" as const
    },
    include: {
      assignments: {
        include: {
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              specialization: true,
              qualification: true,
              experienceYears: true,
              role: true
            }
          }
        }
      }
    }
  },
  _count: {
    select: {
      shifts: true,
      resources: true
    }
  }
};

projectsRouter.get("/", async (req, res) => {
  const projects = await prisma.project.findMany({
    where: projectScope(req.auth!.userId, req.auth!.role),
    orderBy: {
      createdAt: "desc"
    },
    include: projectInclude
  });

  res.status(200).json(projects);
});

projectsRouter.get("/:id", async (req, res) => {
  const project = await prisma.project.findFirst({
    where: {
      id: req.params.id,
      ...projectScope(req.auth!.userId, req.auth!.role)
    },
    include: {
      ...projectInclude
    }
  });

  if (!project) {
    return res.status(404).json({
      error: "Project not found"
    });
  }

  res.status(200).json(project);
});

projectsRouter.post(
  "/",
  requireRoles([UserRole.ADMIN, UserRole.COORDINATOR]),
  async (req, res) => {
    const {
      title,
      description,
      address,
      status,
      clientName,
      clientPhone,
      startDate,
      endDate,
      managerId,
      clientId,
      workStage,
      plannedWorkers,
      estimatedBudget
    } = req.body;

    if (!title || typeof title !== "string") {
      return sendBadRequest(res, "title is required");
    }

    if (!address || typeof address !== "string") {
      return sendBadRequest(res, "address is required");
    }

    if (status && !Object.values(ProjectStatus).includes(status)) {
      return sendBadRequest(res, "invalid project status");
    }

    const parsedStartDate = parseOptionalDate(startDate);
    const parsedEndDate = parseOptionalDate(endDate);

    if (startDate && !parsedStartDate) {
      return sendBadRequest(res, "invalid startDate");
    }

    if (endDate && !parsedEndDate) {
      return sendBadRequest(res, "invalid endDate");
    }

    if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
      return sendBadRequest(res, "endDate must be greater than startDate");
    }

    const project = await prisma.project.create({
      data: {
        title: title.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        address: address.trim(),
        status: status ?? ProjectStatus.DRAFT,
        clientName: typeof clientName === "string" ? clientName.trim() || null : null,
        clientPhone: typeof clientPhone === "string" ? clientPhone.trim() || null : null,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        managerId: typeof managerId === "string" ? managerId : null,
        clientId: typeof clientId === "string" ? clientId : null,
        workStage: typeof workStage === "string" ? workStage.trim() || null : null,
        plannedWorkers:
          Number.isInteger(plannedWorkers) && plannedWorkers > 0 ? plannedWorkers : null,
        estimatedBudget:
          estimatedBudget !== undefined && estimatedBudget !== "" ? Number(estimatedBudget) : null
      },
      include: projectInclude
    });

    res.status(201).json(project);
  }
);

projectsRouter.patch(
  "/:id",
  requireRoles([UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MANAGER]),
  async (req, res) => {
    const projectId = String(req.params.id);
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...projectScope(req.auth!.userId, req.auth!.role)
      }
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }

    const {
      status,
      managerId,
      workStage,
      plannedWorkers,
      estimatedBudget,
      plannedStartDate,
      plannedEndDate,
      managerPlanNote
    } = req.body;

    if (status && !Object.values(ProjectStatus).includes(status)) {
      return sendBadRequest(res, "invalid project status");
    }

    const updated = await prisma.project.update({
      where: {
        id: project.id
      },
      data: {
        status: status || undefined,
        managerId:
          req.auth!.role === UserRole.ADMIN || req.auth!.role === UserRole.COORDINATOR
            ? typeof managerId === "string"
              ? managerId
              : undefined
            : undefined,
        workStage: typeof workStage === "string" ? workStage.trim() || null : undefined,
        plannedWorkers:
          Number.isInteger(plannedWorkers) && plannedWorkers > 0 ? plannedWorkers : undefined,
        estimatedBudget:
          estimatedBudget !== undefined && estimatedBudget !== "" ? Number(estimatedBudget) : undefined,
        plannedStartDate: plannedStartDate ? parseOptionalDate(plannedStartDate) : undefined,
        plannedEndDate: plannedEndDate ? parseOptionalDate(plannedEndDate) : undefined,
        managerPlanNote:
          typeof managerPlanNote === "string" ? managerPlanNote.trim() || null : undefined
      },
      include: projectInclude
    });

    res.status(200).json(updated);
  }
);

projectsRouter.delete(
  "/:id",
  requireRoles([UserRole.ADMIN, UserRole.COORDINATOR]),
  async (req, res) => {
    const projectId = String(req.params.id);

    const deleted = await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: {
          id: projectId
        },
        select: {
          id: true,
          requestId: true
        }
      });

      if (!project) {
        return null;
      }

      await tx.shiftAssignment.deleteMany({
        where: {
          shift: {
            projectId: project.id
          }
        }
      });

      await tx.shift.deleteMany({
        where: {
          projectId: project.id
        }
      });

      await tx.resourceNeed.deleteMany({
        where: {
          projectId: project.id
        }
      });

      await tx.project.delete({
        where: {
          id: project.id
        }
      });

      if (project.requestId) {
        await tx.clientRequest.update({
          where: {
            id: project.requestId
          },
          data: {
            status: RequestStatus.IN_REVIEW
          }
        });
      }

      return project;
    });

    if (!deleted) {
      return res.status(404).json({
        error: "Project not found"
      });
    }

    return res.status(204).send();
  }
);

projectsRouter.post(
  "/:id/request-team",
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  async (req, res) => {
    const projectId = String(req.params.id);
    const { plannedWorkers } = req.body;

    if (!Number.isInteger(plannedWorkers) || plannedWorkers < 1) {
      return sendBadRequest(res, "plannedWorkers must be a positive integer");
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...projectScope(req.auth!.userId, req.auth!.role)
      }
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }

    const updated = await prisma.project.update({
      where: {
        id: project.id
      },
      data: {
        plannedWorkers,
        workflowStatus: ProjectWorkflowStatus.PLANNING,
        teamRequestedAt: new Date(),
        workStage: "Прораб собирает команду"
      },
      include: projectInclude
    });

    res.status(200).json(updated);
  }
);

projectsRouter.post(
  "/:id/submit-plan",
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  async (req, res) => {
    const projectId = String(req.params.id);
    const { plannedStartDate, plannedEndDate, managerPlanNote } = req.body;

    const parsedStart = parseOptionalDate(plannedStartDate);
    const parsedEnd = parseOptionalDate(plannedEndDate);

    if (!parsedStart) {
      return sendBadRequest(res, "plannedStartDate is required");
    }

    if (!parsedEnd) {
      return sendBadRequest(res, "plannedEndDate is required");
    }

    if (parsedEnd < parsedStart) {
      return sendBadRequest(res, "plannedEndDate must be greater than plannedStartDate");
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...projectScope(req.auth!.userId, req.auth!.role)
      },
      include: {
        shifts: {
          include: {
            assignments: true
          }
        },
        resources: true
      }
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }

    if (!project.shifts.some((shift) => shift.kind === ShiftKind.REGULAR)) {
      return sendBadRequest(res, "object work must be published before submitting the plan");
    }

    const confirmedWorkers = new Set(
      project.shifts.flatMap((shift) =>
        shift.kind === ShiftKind.REGULAR
          ? shift.assignments
              .filter((assignment) => assignment.status === ShiftAssignmentStatus.CONFIRMED)
              .map((assignment) => assignment.workerId)
          : []
      )
    );

    if (project.plannedWorkers && confirmedWorkers.size < project.plannedWorkers) {
      return sendBadRequest(res, "team is not fully assembled");
    }

    if (project.resources.length === 0) {
      return sendBadRequest(res, "resource plan is required");
    }

    const updated = await prisma.project.update({
      where: {
        id: project.id
      },
      data: {
        workflowStatus: ProjectWorkflowStatus.PLAN_SUBMITTED,
        plannedStartDate: parsedStart,
        plannedEndDate: parsedEnd,
        planSubmittedAt: new Date(),
        teamReadyAt: project.teamReadyAt || new Date(),
        resourcesReadyAt: project.resourcesReadyAt || new Date(),
        workStage: "План передан координатору, ожидается старт работ",
        managerPlanNote:
          typeof managerPlanNote === "string" ? managerPlanNote.trim() || null : null
      },
      include: projectInclude
    });

    res.status(200).json(updated);
  }
);

projectsRouter.post(
  "/:id/start-work",
  requireRoles([UserRole.ADMIN, UserRole.COORDINATOR]),
  async (req, res) => {
    const projectId = String(req.params.id);
    const { coordinatorNote } = req.body;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...projectScope(req.auth!.userId, req.auth!.role)
      }
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }

    if (project.workflowStatus !== ProjectWorkflowStatus.PLAN_SUBMITTED) {
      return sendBadRequest(res, "project plan must be submitted by manager first");
    }

    const notice = `Работы по объекту "${project.title}" запущены. Плановый старт: ${
      project.plannedStartDate ? project.plannedStartDate.toLocaleDateString("ru-RU") : "не указан"
    }. Ответственный прораб приступил к организации работ.`;

    const updated = await prisma.project.update({
      where: {
        id: project.id
      },
      data: {
        status: ProjectStatus.ACTIVE,
        workflowStatus: ProjectWorkflowStatus.IN_PROGRESS,
        startApprovedAt: new Date(),
        clientNotifiedAt: new Date(),
        clientNotice: notice,
        coordinatorNote:
          typeof coordinatorNote === "string" ? coordinatorNote.trim() || null : null,
        workStage: "Работы начались"
      },
      include: projectInclude
    });

    res.status(200).json(updated);
  }
);

projectsRouter.post(
  "/:id/complete",
  requireRoles([UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MANAGER]),
  async (req, res) => {
    const projectId = String(req.params.id);
    const { completionNote } = req.body as { completionNote?: string };

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...projectScope(req.auth!.userId, req.auth!.role)
      }
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }

    const now = await getDemoNow();
    const notice = `Объект "${project.title}" завершен. Работы приняты, прораб закрывает табель и начисления.`;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.shift.updateMany({
        where: {
          projectId: project.id,
          status: {
            not: ShiftStatus.CANCELLED
          }
        },
        data: {
          status: ShiftStatus.COMPLETED
        }
      });

      await tx.shiftAssignment.updateMany({
        where: {
          status: ShiftAssignmentStatus.CONFIRMED,
          shift: {
            projectId: project.id
          }
        },
        data: {
          status: ShiftAssignmentStatus.ATTENDED
        }
      });

      return tx.project.update({
        where: {
          id: project.id
        },
        data: {
          status: ProjectStatus.COMPLETED,
          workflowStatus: ProjectWorkflowStatus.COMPLETED,
          completedAt: now,
          completionNote: typeof completionNote === "string" ? completionNote.trim() || null : null,
          clientNotice: notice,
          clientNotifiedAt: now,
          workStage: "Объект завершен"
        },
        include: projectInclude
      });
    });

    return res.status(200).json(updated);
  }
);
