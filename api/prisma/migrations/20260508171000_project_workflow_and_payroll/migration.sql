-- CreateEnum
CREATE TYPE "ProjectWorkflowStatus" AS ENUM ('OBJECT_CREATED', 'PLANNING', 'PLAN_SUBMITTED', 'APPROVED_TO_START', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ShiftKind" AS ENUM ('REGULAR', 'PREMIUM');

-- AlterTable
ALTER TABLE "Project"
ADD COLUMN "workflowStatus" "ProjectWorkflowStatus" NOT NULL DEFAULT 'OBJECT_CREATED',
ADD COLUMN "plannedStartDate" TIMESTAMP(3),
ADD COLUMN "plannedEndDate" TIMESTAMP(3),
ADD COLUMN "teamRequestedAt" TIMESTAMP(3),
ADD COLUMN "teamReadyAt" TIMESTAMP(3),
ADD COLUMN "resourcesRequestedAt" TIMESTAMP(3),
ADD COLUMN "resourcesReadyAt" TIMESTAMP(3),
ADD COLUMN "planSubmittedAt" TIMESTAMP(3),
ADD COLUMN "startApprovedAt" TIMESTAMP(3),
ADD COLUMN "clientNotifiedAt" TIMESTAMP(3),
ADD COLUMN "managerPlanNote" TEXT,
ADD COLUMN "coordinatorNote" TEXT,
ADD COLUMN "clientNotice" TEXT;

-- AlterTable
ALTER TABLE "Shift"
ADD COLUMN "payMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.00,
ADD COLUMN "kind" "ShiftKind" NOT NULL DEFAULT 'REGULAR',
ADD COLUMN "isWeekend" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isHoliday" BOOLEAN NOT NULL DEFAULT false;
