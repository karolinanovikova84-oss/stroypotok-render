import { ShiftAssignmentStatus, ShiftKind, ShiftStatus, UserRole } from "@prisma/client";
import { Router } from "express";

import { prisma } from "../lib/prisma";
import { requireAuth, requireRoles } from "../middleware/auth";

export const assignmentsRouter = Router();

const allowedAssignmentStatuses = [
  ShiftAssignmentStatus.CONFIRMED,
  ShiftAssignmentStatus.REJECTED,
  ShiftAssignmentStatus.CANCELLED,
  ShiftAssignmentStatus.ATTENDED,
  ShiftAssignmentStatus.NO_SHOW
] as const;

assignmentsRouter.patch(
  "/:id/status",
  requireAuth,
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  async (req, res) => {
    const assignmentId = String(req.params.id);
    const assignment = await prisma.shiftAssignment.findUnique({
      where: {
        id: assignmentId
      },
      include: {
        shift: {
          select: {
            id: true,
            projectId: true,
            workersNeeded: true,
            startsAt: true,
            endsAt: true,
            kind: true
          }
        }
      }
    });

    if (!assignment) {
      return res.status(404).json({
        error: "Assignment not found"
      });
    }

    const { status } = req.body as { status?: ShiftAssignmentStatus };

    if (!status || !allowedAssignmentStatuses.includes(status as (typeof allowedAssignmentStatuses)[number])) {
      return res.status(400).json({
        error: "Invalid assignment status"
      });
    }

    if (status === ShiftAssignmentStatus.CONFIRMED) {
      const confirmedCount = await prisma.shiftAssignment.count({
        where: {
          shiftId: assignment.shiftId,
          status: ShiftAssignmentStatus.CONFIRMED
        }
      });

      if (confirmedCount >= assignment.shift.workersNeeded) {
        return res.status(400).json({
          error: "Shift already has enough confirmed workers"
        });
      }

      const overlappingConfirmed = await prisma.shiftAssignment.findFirst({
        where: {
          id: {
            not: assignment.id
          },
          workerId: assignment.workerId,
          status: ShiftAssignmentStatus.CONFIRMED,
          shift: {
            status: {
              notIn: [ShiftStatus.CANCELLED]
            },
            ...(assignment.shift.kind === ShiftKind.REGULAR
              ? { kind: ShiftKind.REGULAR }
              : { kind: { not: ShiftKind.REGULAR } }),
            startsAt: {
              lt: assignment.shift.endsAt
            },
            endsAt: {
              gt: assignment.shift.startsAt
            }
          }
        }
      });

      if (overlappingConfirmed) {
        return res.status(400).json({
          error: "Worker already has a confirmed shift at this time"
        });
      }
    }

    const updated = await prisma.shiftAssignment.update({
      where: {
        id: assignment.id
      },
      data: {
        status,
        confirmedAt:
          status === ShiftAssignmentStatus.CONFIRMED ? new Date() : assignment.confirmedAt
      },
      include: {
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
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

    if (status === ShiftAssignmentStatus.CONFIRMED) {
      const project = await prisma.project.findUnique({
        where: {
          id: assignment.shift.projectId
        },
        include: {
          shifts: {
            include: {
              assignments: true
            }
          }
        }
      });

      const confirmedWorkers = new Set(
        project?.shifts.flatMap((shift) =>
          shift.kind === ShiftKind.REGULAR
            ? shift.assignments
                .filter((item) => item.status === ShiftAssignmentStatus.CONFIRMED)
                .map((item) => item.workerId)
            : []
        ) || []
      );

      if (project?.plannedWorkers && confirmedWorkers.size >= project.plannedWorkers) {
        await prisma.project.update({
          where: {
            id: project.id
          },
          data: {
            teamReadyAt: new Date(),
            workStage: "Команда собрана, ожидается план прораба"
          }
        });
      }

      const confirmedForShift = await prisma.shiftAssignment.count({
        where: {
          shiftId: assignment.shiftId,
          status: ShiftAssignmentStatus.CONFIRMED
        }
      });

      if (confirmedForShift >= assignment.shift.workersNeeded) {
        await prisma.shift.update({
          where: {
            id: assignment.shiftId
          },
          data: {
            status: ShiftStatus.FULL
          }
        });
      }
    }

    return res.status(200).json(updated);
  }
);
