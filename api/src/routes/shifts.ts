import { ProjectStatus, ProjectWorkflowStatus, ShiftAssignmentStatus, ShiftKind, ShiftStatus, UserRole, WorkSchedule } from "@prisma/client";
import { Router } from "express";

import { getDemoNow } from "../lib/demo-time";
import { parseRequiredDate, sendBadRequest } from "../lib/http";
import { countPlannedShifts } from "../lib/schedule";
import { requireAuth, requireRoles } from "../middleware/auth";
import { prisma } from "../lib/prisma";

export const shiftsRouter = Router();

shiftsRouter.use(requireAuth);

function shiftScope(userId: string, role: string, projectId?: string) {
  const base = projectId ? { projectId } : {};

  if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) {
    return base;
  }

  if (role === UserRole.MANAGER) {
    return {
      ...base,
      project: {
        managerId: userId
      }
    };
  }

  if (role === UserRole.CLIENT) {
    return {
      ...base,
      project: {
        clientId: userId
      }
    };
  }

  return {
    ...base,
    AND: [
      {
        status: {
          not: ShiftStatus.CANCELLED
        }
      },
      {
        OR: [
          {
            status: ShiftStatus.OPEN
          },
          {
            assignments: {
              some: {
                workerId: userId,
                status: {
                  notIn: [ShiftAssignmentStatus.CANCELLED, ShiftAssignmentStatus.REJECTED]
                }
              }
            }
          }
        ]
      }
    ]
  };
}

const shiftInclude = {
  project: {
    select: {
      id: true,
      title: true,
      address: true,
      status: true,
      managerId: true,
      clientId: true
    }
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true
    }
  },
  _count: {
    select: {
      assignments: true
    }
  },
  assignments: {
    select: {
      id: true,
      status: true,
      workerId: true,
      worker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          specialization: true,
          qualification: true,
          experienceYears: true
        }
      }
    }
  }
};

shiftsRouter.get("/", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;

  const shifts = await prisma.shift.findMany({
    where: shiftScope(req.auth!.userId, req.auth!.role, projectId),
    orderBy: {
      startsAt: "asc"
    },
    include: shiftInclude
  });

  res.status(200).json(shifts);
});

shiftsRouter.get("/:id", async (req, res) => {
  const shift = await prisma.shift.findFirst({
    where: {
      id: req.params.id,
      ...shiftScope(req.auth!.userId, req.auth!.role)
    },
    include: {
      ...shiftInclude,
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
        },
        orderBy: {
          appliedAt: "asc"
        }
      }
    }
  });

  if (!shift) {
    return res.status(404).json({
      error: "Shift not found"
    });
  }

  res.status(200).json(shift);
});

shiftsRouter.post(
  "/",
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  async (req, res) => {
    const {
      projectId,
      title,
      description,
      startsAt,
      endsAt,
      workersNeeded,
      hourlyRate,
      payMultiplier,
      shiftHours,
      estimatedShiftCount,
      kind,
      workSchedule,
      isWeekend,
      isHoliday,
      status
    } = req.body;

    if (!projectId || typeof projectId !== "string") {
      return sendBadRequest(res, "projectId is required");
    }

    if (!title || typeof title !== "string") {
      return sendBadRequest(res, "title is required");
    }

    const parsedStartsAt = parseRequiredDate(startsAt);
    const parsedEndsAt = parseRequiredDate(endsAt);

    if (!parsedStartsAt) {
      return sendBadRequest(res, "invalid startsAt");
    }

    if (!parsedEndsAt) {
      return sendBadRequest(res, "invalid endsAt");
    }

    if (parsedEndsAt <= parsedStartsAt) {
      return sendBadRequest(res, "endsAt must be greater than startsAt");
    }

    if (!Number.isInteger(workersNeeded) || workersNeeded < 1) {
      return sendBadRequest(res, "workersNeeded must be a positive integer");
    }

    const parsedHourlyRate = Number(hourlyRate);
    if (Number.isNaN(parsedHourlyRate) || parsedHourlyRate <= 0) {
      return sendBadRequest(res, "hourlyRate must be a positive number");
    }

    if (status && !Object.values(ShiftStatus).includes(status)) {
      return sendBadRequest(res, "invalid shift status");
    }

    if (kind && !Object.values(ShiftKind).includes(kind)) {
      return sendBadRequest(res, "invalid shift kind");
    }

    const selectedKind = kind ?? ShiftKind.REGULAR;
    const selectedSchedule = workSchedule ?? WorkSchedule.FIVE_TWO;

    if (!Object.values(WorkSchedule).includes(selectedSchedule)) {
      return sendBadRequest(res, "invalid work schedule");
    }

    const parsedMultiplier = Number(payMultiplier ?? 1);
    if (Number.isNaN(parsedMultiplier) || parsedMultiplier < 1 || parsedMultiplier > 5) {
      return sendBadRequest(res, "payMultiplier must be between 1 and 5");
    }

    const fallbackShiftHours =
      (parsedEndsAt.getTime() - parsedStartsAt.getTime()) / 1000 / 60 / 60;
    const parsedShiftHours = Number(shiftHours ?? fallbackShiftHours);
    if (Number.isNaN(parsedShiftHours) || parsedShiftHours <= 0 || parsedShiftHours > 24) {
      return sendBadRequest(res, "shiftHours must be between 0 and 24");
    }

    const parsedEstimatedShiftCount =
      estimatedShiftCount === undefined || estimatedShiftCount === null || estimatedShiftCount === ""
        ? null
        : Number(estimatedShiftCount);

    if (
      selectedKind === ShiftKind.REGULAR &&
      parsedEstimatedShiftCount !== null &&
      (!Number.isInteger(parsedEstimatedShiftCount) || Number(parsedEstimatedShiftCount) < 1)
    ) {
      return sendBadRequest(res, "estimatedShiftCount must be a positive integer");
    }

    if (selectedKind === ShiftKind.PREMIUM && !Boolean(isWeekend) && !Boolean(isHoliday)) {
      return sendBadRequest(res, "premium shift must be marked as weekend or holiday");
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(req.auth!.role === UserRole.MANAGER ? { managerId: req.auth!.userId } : {})
      }
    });

    if (!project) {
      return res.status(404).json({
        error: "Project not found"
      });
    }

    if (selectedKind === ShiftKind.REGULAR) {
      const existingObjectWork = await prisma.shift.findFirst({
        where: {
          projectId,
          kind: ShiftKind.REGULAR,
          status: {
            not: ShiftStatus.CANCELLED
          }
        }
      });

      if (existingObjectWork) {
        return sendBadRequest(res, "object work has already been created for this project");
      }
    }

    const shift = await prisma.shift.create({
      data: {
        projectId,
        createdById: req.auth!.userId,
        title: title.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        startsAt: parsedStartsAt,
        endsAt: parsedEndsAt,
        workersNeeded,
        hourlyRate: parsedHourlyRate,
        payMultiplier: selectedKind === ShiftKind.PREMIUM ? parsedMultiplier : 1,
        shiftHours: parsedShiftHours,
        estimatedShiftCount:
          selectedKind === ShiftKind.REGULAR || selectedKind === ShiftKind.REPLACEMENT
            ? Number(parsedEstimatedShiftCount ?? countPlannedShifts(parsedStartsAt, parsedEndsAt, selectedSchedule))
            : null,
        kind: selectedKind,
        workSchedule: selectedSchedule,
        isWeekend: Boolean(isWeekend),
        isHoliday: Boolean(isHoliday),
        status: status ?? ShiftStatus.PLANNED
      },
      include: shiftInclude
    });

    await prisma.project.update({
      where: {
        id: project.id
      },
      data: {
        workflowStatus: ProjectWorkflowStatus.PLANNING,
        teamRequestedAt: new Date(),
        plannedStartDate: selectedKind === ShiftKind.REGULAR ? parsedStartsAt : undefined,
        plannedEndDate: selectedKind === ShiftKind.REGULAR ? parsedEndsAt : undefined,
        workSchedule: selectedKind === ShiftKind.REGULAR ? selectedSchedule : undefined,
        workStage: "Прораб собирает команду"
      }
    });

    res.status(201).json(shift);
  }
);

shiftsRouter.delete(
  "/:id",
  requireRoles([UserRole.ADMIN, UserRole.COORDINATOR]),
  async (req, res) => {
    const shiftId = String(req.params.id);

    const deleted = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({
        where: {
          id: shiftId
        },
        select: {
          id: true
        }
      });

      if (!shift) {
        return null;
      }

      await tx.shiftAssignment.deleteMany({
        where: {
          shiftId: shift.id
        }
      });

      await tx.shift.delete({
        where: {
          id: shift.id
        }
      });

      return shift;
    });

    if (!deleted) {
      return res.status(404).json({
        error: "Shift not found"
      });
    }

    return res.status(204).send();
  }
);

shiftsRouter.post(
  "/:id/apply",
  requireRoles([UserRole.WORKER]),
  async (req, res) => {
    const shiftId = String(req.params.id);
    const shift = await prisma.shift.findUnique({
      where: {
        id: shiftId
      },
      include: {
        project: true
      }
    });

    if (!shift) {
      return res.status(404).json({
        error: "Shift not found"
      });
    }

    if (shift.status !== ShiftStatus.OPEN && shift.status !== ShiftStatus.PLANNED) {
      return res.status(400).json({
        error: "Shift is not open for applications"
      });
    }

    const now = await getDemoNow();
    if (shift.project.status === ProjectStatus.COMPLETED || shift.project.workflowStatus === ProjectWorkflowStatus.COMPLETED) {
      return res.status(400).json({
        error: "Project is already completed"
      });
    }

    if (shift.kind === ShiftKind.REGULAR) {
      if (
        shift.project.status === ProjectStatus.ACTIVE ||
        shift.project.workflowStatus === ProjectWorkflowStatus.IN_PROGRESS ||
        now >= shift.startsAt
      ) {
        return res.status(400).json({
          error: "Object work has already started"
        });
      }
    } else if (now >= shift.startsAt) {
      return res.status(400).json({
        error: "Shift has already started"
      });
    }

    if (shift.kind === ShiftKind.PREMIUM && !shift.isWeekend && !shift.isHoliday) {
      return res.status(400).json({
        error: "Premium shifts are available only on weekends or holidays"
      });
    }

    const confirmedCount = await prisma.shiftAssignment.count({
      where: {
        shiftId: shift.id,
        status: ShiftAssignmentStatus.CONFIRMED
      }
    });

    if (confirmedCount >= shift.workersNeeded) {
      return res.status(400).json({
        error: "Shift is already full"
      });
    }

    const existingAssignment = await prisma.shiftAssignment.findUnique({
      where: {
        shiftId_workerId: {
          shiftId: shift.id,
          workerId: req.auth!.userId
        }
      }
    });

    if (existingAssignment) {
      return res.status(400).json({
        error: "You have already applied to this shift"
      });
    }

    const overlappingAssignment = await prisma.shiftAssignment.findFirst({
      where: {
        workerId: req.auth!.userId,
        status: {
          in: [
            ShiftAssignmentStatus.APPLIED,
            ShiftAssignmentStatus.CONFIRMED,
            ShiftAssignmentStatus.ATTENDED
          ]
        },
        shift: {
          status: {
            notIn: [ShiftStatus.CANCELLED]
          },
          ...(shift.kind === ShiftKind.REGULAR
            ? { kind: ShiftKind.REGULAR }
            : { kind: { not: ShiftKind.REGULAR } }),
          startsAt: {
            lt: shift.endsAt
          },
          endsAt: {
            gt: shift.startsAt
          }
        }
      },
      include: {
        shift: {
          include: {
            project: {
              select: {
                title: true
              }
            }
          }
        }
      }
    });

    if (overlappingAssignment) {
      return res.status(400).json({
        error: `Shift overlaps with "${overlappingAssignment.shift.title}" on project "${overlappingAssignment.shift.project.title}"`
      });
    }

    const assignment = await prisma.shiftAssignment.create({
      data: {
        shiftId: shift.id,
        workerId: req.auth!.userId,
        status: ShiftAssignmentStatus.APPLIED
      },
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
        },
        shift: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            shiftHours: true,
            estimatedShiftCount: true,
            hourlyRate: true,
            payMultiplier: true,
            kind: true,
            isWeekend: true,
            isHoliday: true,
            project: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    });

    return res.status(201).json(assignment);
  }
);
