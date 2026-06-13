import { PayrollStatus, ShiftAssignmentStatus, ShiftKind, UserRole } from "@prisma/client";
import { Router } from "express";

import { getDemoNow } from "../lib/demo-time";
import { countElapsedPlannedShifts, countPlannedShifts } from "../lib/schedule";
import { parseRequiredDate, sendBadRequest } from "../lib/http";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRoles } from "../middleware/auth";

export const payrollRouter = Router();

payrollRouter.use(requireAuth);

function payrollScope(userId: string, role: string) {
  if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) {
    return {};
  }

  if (role === UserRole.MANAGER) {
    return {
      shift: {
        project: {
          managerId: userId
        }
      }
    };
  }

  return {
    workerId: userId
  };
}

const assignmentInclude = {
  worker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true
    }
  },
  shift: {
    include: {
      project: {
        select: {
          id: true,
          title: true,
          address: true,
          status: true,
          workflowStatus: true
        }
      }
    }
  },
  absenceRequests: {
    where: {
      status: "APPROVED" as const
    }
  },
  payrollDeductions: {
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true
        }
      }
    },
    orderBy: {
      createdAt: "desc" as const
    }
  }
};

function payrollForAssignment(assignment: any, now: Date) {
  const shift = assignment.shift;
  const hourlyRate = Number(shift.hourlyRate);
  const shiftHours = Number(shift.shiftHours);
  const multiplier = Number(shift.payMultiplier || 1);
  const schedule = shift.workSchedule;
  const deductionAmount = (assignment.payrollDeductions || []).reduce(
    (sum: number, deduction: { amount: unknown }) => sum + Number(deduction.amount || 0),
    0
  );

  if (shift.kind === ShiftKind.REGULAR || shift.kind === ShiftKind.REPLACEMENT) {
    const scheduledShifts =
      assignment.scheduledShifts ||
      shift.estimatedShiftCount ||
      countPlannedShifts(shift.startsAt, shift.endsAt, schedule);
    const elapsed = countElapsedPlannedShifts(shift.startsAt, shift.endsAt, schedule, now);
    const workedShifts = Math.max(0, Math.min(scheduledShifts, elapsed));
    const grossAmount = workedShifts * shiftHours * hourlyRate;

    return {
      scheduledShifts,
      workedShifts,
      grossAmount,
      deductionAmount,
      accruedAmount: Math.max(0, grossAmount - deductionAmount)
    };
  }

  const shiftFinished = now >= shift.endsAt;
  const workedShifts =
    shiftFinished && [ShiftAssignmentStatus.CONFIRMED, ShiftAssignmentStatus.ATTENDED].includes(assignment.status)
      ? 1
      : 0;
  const hours = Math.max(0, (shift.endsAt.getTime() - shift.startsAt.getTime()) / 1000 / 60 / 60);
  const grossAmount = workedShifts * hours * hourlyRate * multiplier;

  return {
    scheduledShifts: 1,
    workedShifts,
    grossAmount,
    deductionAmount,
    accruedAmount: Math.max(0, grossAmount - deductionAmount)
  };
}

function payrollResponse(assignment: any, now: Date) {
  return {
    id: assignment.id,
    status: assignment.status,
    payrollStatus: assignment.payrollStatus,
    paidAmount: assignment.paidAmount,
    ...payrollForAssignment(assignment, now),
    payrollDeductions: assignment.payrollDeductions || [],
    worker: assignment.worker,
    shift: assignment.shift
  };
}

payrollRouter.get("/", async (req, res) => {
  const now = await getDemoNow();
  const rows = await prisma.shiftAssignment.findMany({
    where: {
      ...payrollScope(req.auth!.userId, req.auth!.role),
      status: {
        in: [ShiftAssignmentStatus.CONFIRMED, ShiftAssignmentStatus.ATTENDED]
      }
    },
    include: assignmentInclude,
    orderBy: {
      updatedAt: "desc"
    }
  });

  return res.status(200).json(
    rows.map((assignment) => payrollResponse(assignment as any, now))
  );
});

payrollRouter.post(
  "/:assignmentId/deductions",
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  async (req, res) => {
    const { startsAt, endsAt, shiftsCount, amount, reason } = req.body as {
      startsAt?: string;
      endsAt?: string;
      shiftsCount?: number;
      amount?: number | string;
      reason?: string;
    };

    const parsedStart = parseRequiredDate(startsAt);
    const parsedEnd = parseRequiredDate(endsAt);
    if (!parsedStart || !parsedEnd || parsedEnd < parsedStart) {
      return sendBadRequest(res, "valid deduction period is required");
    }

    const parsedShiftsCount = Number(shiftsCount);
    if (!Number.isInteger(parsedShiftsCount) || parsedShiftsCount < 1) {
      return sendBadRequest(res, "shiftsCount must be a positive integer");
    }

    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        id: String(req.params.assignmentId),
        ...payrollScope(req.auth!.userId, req.auth!.role)
      },
      include: assignmentInclude
    });

    if (!assignment) {
      return res.status(404).json({
        error: "Payroll assignment not found"
      });
    }

    const defaultAmount =
      parsedShiftsCount *
      Number(assignment.shift.shiftHours) *
      Number(assignment.shift.hourlyRate) *
      Number(assignment.shift.payMultiplier || 1);
    const parsedAmount = amount === undefined || amount === "" ? defaultAmount : Number(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return sendBadRequest(res, "deduction amount must be a positive number");
    }

    await prisma.payrollDeduction.create({
      data: {
        assignmentId: assignment.id,
        createdById: req.auth!.userId,
        startsAt: parsedStart,
        endsAt: parsedEnd,
        shiftsCount: parsedShiftsCount,
        amount: parsedAmount,
        reason: typeof reason === "string" ? reason.trim() || null : null
      }
    });

    const now = await getDemoNow();
    const updated = await prisma.shiftAssignment.findUniqueOrThrow({
      where: {
        id: assignment.id
      },
      include: assignmentInclude
    });
    const payroll = payrollForAssignment(updated as any, now);

    await prisma.shiftAssignment.update({
      where: {
        id: assignment.id
      },
      data: {
        scheduledShifts: payroll.scheduledShifts,
        workedShifts: payroll.workedShifts,
        accruedAmount: payroll.accruedAmount,
        paidAmount: 0,
        payrollStatus: PayrollStatus.ACCRUED,
        payrollUpdatedAt: now
      }
    });

    return res.status(201).json(payrollResponse(updated as any, now));
  }
);

payrollRouter.delete(
  "/deductions/:deductionId",
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  async (req, res) => {
    const deduction = await prisma.payrollDeduction.findFirst({
      where: {
        id: String(req.params.deductionId),
        assignment: payrollScope(req.auth!.userId, req.auth!.role)
      },
      include: {
        assignment: {
          include: assignmentInclude
        }
      }
    });

    if (!deduction) {
      return res.status(404).json({
        error: "Payroll deduction not found"
      });
    }

    await prisma.payrollDeduction.delete({
      where: {
        id: deduction.id
      }
    });

    const now = await getDemoNow();
    const updated = await prisma.shiftAssignment.findUniqueOrThrow({
      where: {
        id: deduction.assignmentId
      },
      include: assignmentInclude
    });
    const payroll = payrollForAssignment(updated as any, now);

    await prisma.shiftAssignment.update({
      where: {
        id: deduction.assignmentId
      },
      data: {
        scheduledShifts: payroll.scheduledShifts,
        workedShifts: payroll.workedShifts,
        accruedAmount: payroll.accruedAmount,
        paidAmount: 0,
        payrollStatus: PayrollStatus.ACCRUED,
        payrollUpdatedAt: now
      }
    });

    return res.status(200).json(payrollResponse(updated as any, now));
  }
);

payrollRouter.patch(
  "/:assignmentId",
  requireRoles([UserRole.ADMIN, UserRole.MANAGER]),
  async (req, res) => {
    const { payrollStatus } = req.body as { payrollStatus?: PayrollStatus };

    if (!payrollStatus || !Object.values(PayrollStatus).includes(payrollStatus)) {
      return sendBadRequest(res, "valid payroll status is required");
    }

    const now = await getDemoNow();
    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        id: String(req.params.assignmentId),
        ...payrollScope(req.auth!.userId, req.auth!.role)
      },
      include: assignmentInclude
    });

    if (!assignment) {
      return res.status(404).json({
        error: "Payroll assignment not found"
      });
    }

    const payroll = payrollForAssignment(assignment as any, now);
    const updated = await prisma.shiftAssignment.update({
      where: {
        id: assignment.id
      },
      data: {
        scheduledShifts: payroll.scheduledShifts,
        workedShifts: payroll.workedShifts,
        accruedAmount: payroll.accruedAmount,
        paidAmount: payrollStatus === PayrollStatus.PAID ? payroll.accruedAmount : assignment.paidAmount,
        payrollStatus,
        payrollUpdatedAt: now
      },
      include: assignmentInclude
    });

    return res.status(200).json(payrollResponse(updated as any, now));
  }
);
