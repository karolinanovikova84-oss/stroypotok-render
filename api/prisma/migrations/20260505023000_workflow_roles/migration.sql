-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'IN_REVIEW', 'ESTIMATING', 'APPROVED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ResourceStatus" AS ENUM ('NEEDED', 'ORDERED', 'RESERVED', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Project"
ADD COLUMN "clientId" TEXT,
ADD COLUMN "requestId" TEXT,
ADD COLUMN "workStage" TEXT,
ADD COLUMN "plannedWorkers" INTEGER,
ADD COLUMN "estimatedBudget" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "ClientRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientEmail" TEXT,
    "desiredStartDate" TIMESTAMP(3),
    "desiredEndDate" TIMESTAMP(3),
    "budget" DECIMAL(12,2),
    "priority" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "RequestStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceNeed" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "status" "ResourceStatus" NOT NULL DEFAULT 'NEEDED',
    "supplier" TEXT,
    "estimatedCost" DECIMAL(12,2),
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceNeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_requestId_key" ON "Project"("requestId");

-- AddForeignKey
ALTER TABLE "ClientRequest" ADD CONSTRAINT "ClientRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ClientRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceNeed" ADD CONSTRAINT "ResourceNeed_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
