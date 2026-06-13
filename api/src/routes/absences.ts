import { AbsenceStatus, AbsenceType, ProjectWorkflowStatus, ShiftKind, ShiftStatus, UserRole, WorkSchedule } from "@prisma/client";
import { Router } from "express";

import { getDemoNow } from "../lib/demo-time";
import { parseRequiredDate, sendBadRequest } from "../lib/http";
import { countPlannedShifts } from "../lib/schedule";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRoles } from "../middleware/auth";

export const absencesRouter = Router();

absencesRouter.use(requireAuth);

const absenceInclude = {
  worker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true
    }
  },
  project: {
    select: {
      id: true,
      title: true,
      address: true,
      managerId: true,
      workflowStatus: true
    }
  },
  assignment: {
    select: {
      id: true,
      status: true,
      shift: {
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          shiftHours: true,
          hourlyRate: true,
          workSchedule: true
        }
      }
    }
  },
  replacementShift: {
    select: {
      id: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true
    }
  }
};

function absenceScope(userId: string, role: string) {
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
    workerId: userId
  };
}

absencesRouter.get("/", async (req, res) => {
  const rows = await prisma.absenceRequest.findMany({
    where: absenceScope(req.auth!.userId, req.auth!.role),
    include: absenceInclude,
    orderBy: {
      createdAt: "desc"
    }
  });

  return res.status(200).json(rows);
});

absencesRouter.post(
  "/",
  requireRoles([UserRole.WORKER]),
  async (req, res) => {
    const { projectId, assignmentId, type, startsAt, endsAt, reason } = req.body;

    if (!projectId || typeof projectId !== "string") {
      return sendBadRequest(res, "projectId is required");
    }

    if (!type || !Object.values(AbsenceType).includes(type)) {
      return sendBadRequest(res, "valid absence type is required");
    }

    const parsedStart = parseRequiredDate(startsAt);
    const parsedEnd = parseRequiredDate(endsAt);

    if (!parsedStart || !parsedEnd || parsedEnd < parsedStart) {
      return sendBadRequest(res, "valid absence period is required");
    }

    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        workerId: req.auth!.userId,
        ...(typeof assignmentId === "string" ? { id: assignmentId } : {}),
        shift: {
          projectId,
          kind: ShiftKind.REGULAR
        },
        status: {
          in: ["CONFIRMED", "ATTENDED"]
        }
      },
      include: {
        shift: true
      }
    });

    if (!assignment) {
      return sendBadRequest(res, "worker must have confirmed object assignment");
    }

    const absence = await prisma.absenceRequest.create({
      data: {
        workerId: req.auth!.userId,
        projectId,
        assignmentId: assignment.id,
        type,
        startsAt: parsedStart,
        endsAt: parsedEnd,
        reason: typeof reason === "string" ? reason.trim() || null : null
      },
      include: absenceInclude
    });

    return res.status(201).json(absence);
  }
);

absencesRouter.patch(
  "/:id",
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  async (req, res) => {
    const { status, managerNote } = req.body as { status?: AbsenceStatus; managerNote?: string };

    if (!status || !Object.values(AbsenceStatus).includes(status)) {
      return sendBadRequest(res, "valid absence status is required");
    }

    const absence = await prisma.absenceRequest.findFirst({
      where: {
        id: String(req.params.id),
        ...absenceScope(req.auth!.userId, req.auth!.role)
      }
    });

    if (!absence) {
      return res.status(404).json({
        error: "Absence request not found"
      });
    }

    const updated = await prisma.absenceRequest.update({
      where: {
        id: absence.id
      },
      data: {
        status,
        managerNote: typeof managerNote === "string" ? managerNote.trim() || null : undefined,
        reviewedById: req.auth!.userId,
        reviewedAt: new Date()
      },
      include: absenceInclude
    });

    return res.status(200).json(updated);
  }
);

absencesRouter.post(
  "/:id/replacement",
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  async (req, res) => {
    const absence = await prisma.absenceRequest.findFirst({
      where: {
        id: String(req.params.id),
        ...absenceScope(req.auth!.userId, req.auth!.role)
      },
      include: {
        project: true,
        assignment: {
          include: {
            shift: true
          }
        }
      }
    });

    if (!absence) {
      return res.status(404).json({
        error: "Absence request not found"
      });
    }

    if (absence.replacementShiftId) {
      return sendBadRequest(res, "replacement shift already exists");
    }

    const baseShift = (absence as any).assignment?.shift;
    if (!baseShift) {
      return sendBadRequest(res, "absence is not linked to object work");
    }

    const now = await getDemoNow();
    const startsAt = absence.startsAt > now ? absence.startsAt : now;
    const endsAt = absence.endsAt;
    const replacement = await prisma.shift.create({
      data: {
        projectId: absence.projectId,
        createdById: req.auth!.userId,
        title: `Замена на период отсутствия: ${baseShift.title}`,
        description: "Смена на замену из-за больничного или отпуска рабочего.",
        startsAt,
        endsAt,
        workersNeeded: 1,
        hourlyRate: baseShift.hourlyRate,
        payMultiplier: 1,
        shiftHours: baseShift.shiftHours,
        estimatedShiftCount: countPlannedShifts(startsAt, endsAt, baseShift.workSchedule as WorkSchedule),
        kind: ShiftKind.REPLACEMENT,
        workSchedule: baseShift.workSchedule,
        status: ShiftStatus.OPEN
      }
    });

    const updated = await prisma.absenceRequest.update({
      where: {
        id: absence.id
      },
      data: {
        status: AbsenceStatus.APPROVED,
        reviewedById: req.auth!.userId,
        reviewedAt: now,
        replacementShiftId: replacement.id
      },
      include: absenceInclude
    });

    await prisma.project.update({
      where: {
        id: absence.projectId
      },
      data: {
        workflowStatus: ProjectWorkflowStatus.IN_PROGRESS,
        workStage: "Прораб опубликовал смену на замену"
      }
    });

    return res.status(201).json(updated);
  }
);
