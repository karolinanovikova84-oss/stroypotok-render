CREATE TABLE "PayrollDeduction" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "createdById" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "shiftsCount" INTEGER NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayrollDeduction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollDeduction_assignmentId_idx" ON "PayrollDeduction"("assignmentId");
CREATE INDEX "PayrollDeduction_createdById_idx" ON "PayrollDeduction"("createdById");

ALTER TABLE "PayrollDeduction"
  ADD CONSTRAINT "PayrollDeduction_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "ShiftAssignment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollDeduction"
  ADD CONSTRAINT "PayrollDeduction_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
