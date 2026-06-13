ALTER TYPE "ShiftKind" ADD VALUE IF NOT EXISTS 'REPLACEMENT';

CREATE TYPE "WorkSchedule" AS ENUM ('FIVE_TWO', 'TWO_TWO');
CREATE TYPE "AbsenceType" AS ENUM ('SICK_LEAVE', 'VACATION');
CREATE TYPE "AbsenceStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "PayrollStatus" AS ENUM ('ACCRUED', 'APPROVED', 'PAID');

ALTER TABLE "Project"
ADD COLUMN "workSchedule" "WorkSchedule" NOT NULL DEFAULT 'FIVE_TWO',
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "completionNote" TEXT,
ADD COLUMN "payrollClosedAt" TIMESTAMP(3);

ALTER TABLE "Shift"
ADD COLUMN "workSchedule" "WorkSchedule" NOT NULL DEFAULT 'FIVE_TWO';

ALTER TABLE "ShiftAssignment"
ADD COLUMN "scheduledShifts" INTEGER,
ADD COLUMN "workedShifts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "accruedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN "payrollStatus" "PayrollStatus" NOT NULL DEFAULT 'ACCRUED',
ADD COLUMN "payrollUpdatedAt" TIMESTAMP(3);

CREATE TABLE "AbsenceRequest" (
  "id" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "assignmentId" TEXT,
  "reviewedById" TEXT,
  "replacementShiftId" TEXT,
  "type" "AbsenceType" NOT NULL,
  "status" "AbsenceStatus" NOT NULL DEFAULT 'REQUESTED',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "managerNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),

  CONSTRAINT "AbsenceRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AbsenceRequest_replacementShiftId_key" ON "AbsenceRequest"("replacementShiftId");

ALTER TABLE "AbsenceRequest"
ADD CONSTRAINT "AbsenceRequest_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "AbsenceRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "AbsenceRequest_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ShiftAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "AbsenceRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "AbsenceRequest_replacementShiftId_fkey" FOREIGN KEY ("replacementShiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SystemSetting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

UPDATE "Shift"
SET "workSchedule" = 'FIVE_TWO'
WHERE "workSchedule" IS NULL;

UPDATE "Project"
SET "workSchedule" = 'FIVE_TWO'
WHERE "workSchedule" IS NULL;
