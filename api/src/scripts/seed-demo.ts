import {
  PrismaClient,
  ProjectStatus,
  ProjectWorkflowStatus,
  RequestPriority,
  RequestStatus,
  ResourceStatus,
  ShiftKind,
  ShiftAssignmentStatus,
  ShiftStatus,
  UserRole
} from "@prisma/client";

import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();
const passwordHash = hashPassword("demo123");

async function upsertUser(data: {
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  specialization?: string;
  qualification?: string;
  experienceYears?: number;
}) {
  return prisma.user.upsert({
    where: {
      phone: data.phone
    },
    update: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      role: data.role,
      specialization: data.role === UserRole.WORKER ? data.specialization || null : null,
      qualification: data.role === UserRole.WORKER ? data.qualification || null : null,
      experienceYears: data.role === UserRole.WORKER ? data.experienceYears ?? null : null,
      isActive: true
    },
    create: {
      ...data,
      isActive: true,
      passwordHash
    }
  });
}

async function main() {
  const admin = await upsertUser({
    phone: "+7 900 000-00-01",
    firstName: "Анна",
    lastName: "Админова",
    email: "admin@construction.local",
    role: UserRole.ADMIN
  });

  const coordinator = await upsertUser({
    phone: "+7 900 000-00-02",
    firstName: "Кирилл",
    lastName: "Координаторов",
    email: "coordinator@construction.local",
    role: UserRole.COORDINATOR
  });

  const manager = await upsertUser({
    phone: "+7 900 000-00-03",
    firstName: "Павел",
    lastName: "Прорабов",
    email: "manager@construction.local",
    role: UserRole.MANAGER
  });

  const worker = await upsertUser({
    phone: "+7 900 000-00-04",
    firstName: "Илья",
    lastName: "Рабочий",
    email: "worker@construction.local",
    role: UserRole.WORKER,
    specialization: "Отделочные работы",
    qualification: "Маляр-штукатур, 4 разряд",
    experienceYears: 5
  });

  const client = await upsertUser({
    phone: "+7 900 000-00-05",
    firstName: "Мария",
    lastName: "Клиентова",
    email: "client@construction.local",
    role: UserRole.CLIENT
  });

  const request = await prisma.clientRequest.upsert({
    where: {
      id: "demo-request-main"
    },
    update: {
      status: RequestStatus.CONVERTED,
      priority: RequestPriority.HIGH,
      clientId: client.id
    },
    create: {
      id: "demo-request-main",
      title: "Ремонт офиса под отдел продаж",
      description: "Демонтаж старых перегородок, подготовка электрики, отделка open-space зоны и переговорной.",
      address: "Москва, ул. Строителей, 12",
      clientName: "Мария Клиентова",
      clientPhone: client.phone,
      clientEmail: client.email,
      desiredStartDate: new Date("2026-05-12T07:00:00.000Z"),
      desiredEndDate: new Date("2026-05-30T17:00:00.000Z"),
      budget: 850000,
      priority: RequestPriority.HIGH,
      status: RequestStatus.CONVERTED,
      notes: "Клиент просит начать с демонтажа и держать объект в работе без простоев.",
      clientId: client.id
    }
  });

  const project = await prisma.project.upsert({
    where: {
      requestId: request.id
    },
    update: {
      managerId: manager.id,
      clientId: client.id,
      status: ProjectStatus.DRAFT,
      workStage: "План передан координатору",
      workflowStatus: ProjectWorkflowStatus.PLAN_SUBMITTED,
      plannedWorkers: 1,
      plannedStartDate: new Date("2026-05-12T06:00:00.000Z"),
      plannedEndDate: new Date("2026-05-30T15:00:00.000Z"),
      teamRequestedAt: new Date("2026-05-10T08:00:00.000Z"),
      teamReadyAt: new Date("2026-05-10T12:00:00.000Z"),
      resourcesRequestedAt: new Date("2026-05-10T09:00:00.000Z"),
      resourcesReadyAt: new Date("2026-05-10T14:00:00.000Z"),
      planSubmittedAt: new Date("2026-05-10T15:00:00.000Z"),
      managerPlanNote: "Команда собрана, контейнер заказан, демонтаж можно начинать 12 мая."
    },
    create: {
      title: request.title,
      description: request.description,
      address: request.address,
      status: ProjectStatus.DRAFT,
      clientName: request.clientName,
      clientPhone: request.clientPhone,
      startDate: request.desiredStartDate,
      endDate: request.desiredEndDate,
      managerId: manager.id,
      clientId: client.id,
      requestId: request.id,
      workStage: "План передан координатору",
      plannedWorkers: 1,
      estimatedBudget: 850000,
      workflowStatus: ProjectWorkflowStatus.PLAN_SUBMITTED,
      plannedStartDate: new Date("2026-05-12T06:00:00.000Z"),
      plannedEndDate: new Date("2026-05-30T15:00:00.000Z"),
      teamRequestedAt: new Date("2026-05-10T08:00:00.000Z"),
      teamReadyAt: new Date("2026-05-10T12:00:00.000Z"),
      resourcesRequestedAt: new Date("2026-05-10T09:00:00.000Z"),
      resourcesReadyAt: new Date("2026-05-10T14:00:00.000Z"),
      planSubmittedAt: new Date("2026-05-10T15:00:00.000Z"),
      managerPlanNote: "Команда собрана, контейнер заказан, демонтаж можно начинать 12 мая."
    }
  });

  await prisma.resourceNeed.deleteMany({
    where: {
      projectId: project.id
    }
  });

  await prisma.resourceNeed.createMany({
    data: [
      {
        projectId: project.id,
        title: "Контейнер для строительного мусора",
        category: "Логистика",
        quantity: 1,
        unit: "шт.",
        status: ResourceStatus.RESERVED,
        estimatedCost: 18000
      },
      {
        projectId: project.id,
        title: "Бригада демонтажников",
        category: "Персонал",
        quantity: 1,
        unit: "чел.",
        status: ResourceStatus.RESERVED,
        estimatedCost: 24000
      }
    ],
    skipDuplicates: true
  });

  const shift = await prisma.shift.upsert({
    where: {
      id: "demo-shift-main"
    },
    update: {
      projectId: project.id,
      createdById: manager.id,
      startsAt: new Date("2026-05-12T06:00:00.000Z"),
      endsAt: new Date("2026-05-30T15:00:00.000Z"),
      workersNeeded: 1,
      hourlyRate: 550,
      payMultiplier: 1,
      shiftHours: 8,
      estimatedShiftCount: 14,
      kind: ShiftKind.REGULAR,
      isWeekend: false,
      isHoliday: false,
      status: ShiftStatus.FULL
    },
    create: {
      id: "demo-shift-main",
      projectId: project.id,
      createdById: manager.id,
      title: "Демонтаж перегородок",
      description: "Снять старые перегородки, вынести мусор, подготовить помещение под электрику.",
      startsAt: new Date("2026-05-12T06:00:00.000Z"),
      endsAt: new Date("2026-05-30T15:00:00.000Z"),
      workersNeeded: 1,
      hourlyRate: 550,
      payMultiplier: 1,
      shiftHours: 8,
      estimatedShiftCount: 14,
      kind: ShiftKind.REGULAR,
      status: ShiftStatus.FULL
    }
  });

  await prisma.shiftAssignment.upsert({
    where: {
      shiftId_workerId: {
        shiftId: shift.id,
        workerId: worker.id
      }
    },
    update: {
      status: ShiftAssignmentStatus.CONFIRMED,
      confirmedAt: new Date("2026-05-10T12:00:00.000Z")
    },
    create: {
      shiftId: shift.id,
      workerId: worker.id,
      status: ShiftAssignmentStatus.CONFIRMED,
      confirmedAt: new Date("2026-05-10T12:00:00.000Z")
    }
  });

  await prisma.shift.upsert({
    where: {
      id: "demo-shift-premium"
    },
    update: {
      projectId: project.id,
      createdById: manager.id,
      status: ShiftStatus.OPEN,
      kind: ShiftKind.PREMIUM,
      payMultiplier: 2,
      shiftHours: 6,
      estimatedShiftCount: null,
      isWeekend: true
    },
    create: {
      id: "demo-shift-premium",
      projectId: project.id,
      createdById: manager.id,
      title: "Выходная смена по вывозу мусора",
      description: "Повышенный коэффициент за работу в выходной день. Можно откликнуться, если нет другой смены в это время.",
      startsAt: new Date("2026-05-16T07:00:00.000Z"),
      endsAt: new Date("2026-05-16T13:00:00.000Z"),
      workersNeeded: 2,
      hourlyRate: 600,
      payMultiplier: 2,
      shiftHours: 6,
      estimatedShiftCount: null,
      kind: ShiftKind.PREMIUM,
      isWeekend: true,
      status: ShiftStatus.OPEN
    }
  });

  console.log(`Demo data is ready. Admin user: ${admin.phone}, coordinator: ${coordinator.phone}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
