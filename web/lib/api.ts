export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type UserRole = "ADMIN" | "MANAGER" | "COORDINATOR" | "WORKER" | "CLIENT";
export type ProjectStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type ProjectWorkflowStatus =
  | "OBJECT_CREATED"
  | "PLANNING"
  | "PLAN_SUBMITTED"
  | "APPROVED_TO_START"
  | "IN_PROGRESS"
  | "COMPLETED";
export type ShiftStatus = "PLANNED" | "OPEN" | "FULL" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ShiftKind = "REGULAR" | "PREMIUM" | "REPLACEMENT";
export type WorkSchedule = "FIVE_TWO" | "TWO_TWO";
export type AbsenceType = "SICK_LEAVE" | "VACATION";
export type AbsenceStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "CANCELLED";
export type PayrollStatus = "ACCRUED" | "APPROVED" | "PAID";
export type AssignmentStatus =
  | "APPLIED"
  | "CONFIRMED"
  | "REJECTED"
  | "CANCELLED"
  | "ATTENDED"
  | "NO_SHOW";
export type RequestStatus = "NEW" | "IN_REVIEW" | "ESTIMATING" | "APPROVED" | "REJECTED" | "CONVERTED";
export type RequestPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ResourceStatus = "NEEDED" | "ORDERED" | "RESERVED" | "DELIVERED" | "CANCELLED";

export type User = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  role: UserRole;
  specialization: string | null;
  qualification: string | null;
  experienceYears: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    managedProjects: number;
    clientProjects?: number;
    assignments: number;
    createdShifts: number;
  };
};

export type ResourceNeed = {
  id: string;
  projectId: string;
  title: string;
  category: string;
  quantity: string;
  unit: string;
  status: ResourceStatus;
  supplier: string | null;
  estimatedCost: string | null;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  title: string;
  description: string | null;
  address: string;
  status: ProjectStatus;
  clientName: string | null;
  clientPhone: string | null;
  startDate: string | null;
  endDate: string | null;
  managerId?: string | null;
  clientId?: string | null;
  requestId?: string | null;
  workStage?: string | null;
  plannedWorkers?: number | null;
  estimatedBudget?: string | null;
  workflowStatus?: ProjectWorkflowStatus;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  teamRequestedAt?: string | null;
  teamReadyAt?: string | null;
  resourcesRequestedAt?: string | null;
  resourcesReadyAt?: string | null;
  planSubmittedAt?: string | null;
  startApprovedAt?: string | null;
  clientNotifiedAt?: string | null;
  managerPlanNote?: string | null;
  coordinatorNote?: string | null;
  clientNotice?: string | null;
  workSchedule?: WorkSchedule;
  completedAt?: string | null;
  completionNote?: string | null;
  payrollClosedAt?: string | null;
  manager?: Pick<User, "id" | "firstName" | "lastName" | "phone" | "email" | "role"> | null;
  client?: Pick<User, "id" | "firstName" | "lastName" | "phone" | "email"> | null;
  resources?: ResourceNeed[];
  shifts?: Shift[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    shifts: number;
    resources: number;
  };
};

export type ClientRequest = {
  id: string;
  title: string;
  description: string;
  address: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  desiredStartDate: string | null;
  desiredEndDate: string | null;
  budget: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  notes: string | null;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    title: string;
    status: ProjectStatus;
    managerId: string | null;
  } | null;
  client?: Pick<User, "id" | "firstName" | "lastName" | "phone" | "email"> | null;
};

export type Shift = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  workersNeeded: number;
  hourlyRate: string;
  payMultiplier: string;
  shiftHours: string;
  estimatedShiftCount: number | null;
  kind: ShiftKind;
  workSchedule: WorkSchedule;
  isWeekend: boolean;
  isHoliday: boolean;
  status: ShiftStatus;
  projectId: string;
  project?: {
    id: string;
    title: string;
    address: string;
    status?: string;
    managerId?: string | null;
    clientId?: string | null;
  };
  _count?: {
    assignments: number;
  };
  assignments?: Array<{
    id: string;
    status: AssignmentStatus;
    workerId: string;
    worker?: {
      id: string;
      firstName: string;
      lastName: string | null;
      phone: string;
      specialization: string | null;
      qualification: string | null;
      experienceYears: number | null;
    };
  }>;
};

export type AuthUser = Pick<User, "id" | "firstName" | "lastName" | "phone" | "email" | "role" | "specialization" | "qualification" | "experienceYears" | "isActive">;

export type CurrentUser = AuthUser & {
  clientRequests?: Array<Pick<ClientRequest, "id" | "title" | "address" | "status" | "priority" | "createdAt" | "desiredStartDate" | "desiredEndDate">>;
  clientProjects?: Array<Pick<Project, "id" | "title" | "address" | "status" | "workStage" | "workflowStatus" | "plannedStartDate" | "plannedEndDate" | "clientNotice" | "clientNotifiedAt" | "startDate" | "endDate" | "manager" | "_count">>;
  managedProjects?: Array<Pick<Project, "id" | "title" | "address" | "status" | "workStage" | "workflowStatus" | "plannedStartDate" | "plannedEndDate" | "teamReadyAt" | "resourcesReadyAt" | "planSubmittedAt" | "plannedWorkers" | "_count">>;
  createdShifts?: Array<{
    id: string;
    title: string;
    status: string;
    startsAt: string;
    project: {
      title: string;
    };
  }>;
  assignments?: Array<{
    id: string;
    status: AssignmentStatus;
    appliedAt: string;
    confirmedAt: string | null;
    shift: {
      id: string;
      title: string;
      startsAt: string;
      endsAt: string;
      status: string;
      hourlyRate: string;
      payMultiplier: string;
      shiftHours: string;
      estimatedShiftCount: number | null;
      kind: ShiftKind;
      workSchedule: WorkSchedule;
      isWeekend: boolean;
      isHoliday: boolean;
      project: {
        id: string;
        title: string;
        address: string;
      };
    };
  }>;
};

export type AbsenceRequest = {
  id: string;
  workerId: string;
  projectId: string;
  assignmentId: string | null;
  replacementShiftId: string | null;
  type: AbsenceType;
  status: AbsenceStatus;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  managerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  worker?: Pick<User, "id" | "firstName" | "lastName" | "phone" | "specialization" | "qualification" | "experienceYears">;
  project?: Pick<Project, "id" | "title" | "address" | "managerId" | "workflowStatus">;
  assignment?: {
    id: string;
    status: AssignmentStatus;
    shift: Pick<Shift, "id" | "title" | "startsAt" | "endsAt" | "shiftHours" | "hourlyRate" | "workSchedule">;
  } | null;
  replacementShift?: Pick<Shift, "id" | "title" | "status" | "startsAt" | "endsAt"> | null;
};

export type PayrollRow = {
  id: string;
  status: AssignmentStatus;
  payrollStatus: PayrollStatus;
  scheduledShifts: number;
  workedShifts: number;
  grossAmount: number;
  deductionAmount: number;
  accruedAmount: number;
  paidAmount: string;
  payrollDeductions: PayrollDeduction[];
  worker: Pick<User, "id" | "firstName" | "lastName" | "phone" | "specialization" | "qualification" | "experienceYears">;
  shift: Shift & {
    project: Pick<Project, "id" | "title" | "address" | "status" | "workflowStatus">;
  };
};

export type PayrollDeduction = {
  id: string;
  assignmentId: string;
  createdById: string | null;
  startsAt: string;
  endsAt: string;
  shiftsCount: number;
  amount: string;
  reason: string | null;
  createdAt: string;
  createdBy?: Pick<User, "id" | "firstName" | "lastName" | "role"> | null;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

type RequestOptions = RequestInit & {
  token?: string;
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function requestHeaders(token?: string, json = false) {
  const headers: Record<string, string> = {};

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const { token, headers, body, ...rest } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...requestHeaders(token, Boolean(body)),
      ...headers
    },
    body,
    cache: rest.cache || "no-store"
  });

  return handleResponse<T>(response);
}

export function authHeaders(token?: string) {
  return requestHeaders(token);
}

export function login(payload: { phone: string; password: string }) {
  return apiRequest<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function register(payload: {
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  password: string;
  role: "CLIENT" | "WORKER";
  specialization?: string;
  qualification?: string;
  experienceYears?: number | "";
}) {
  return apiRequest<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchCurrentUser(token: string) {
  return apiRequest<CurrentUser>("/api/auth/me", { token });
}

export function fetchRequests(token: string) {
  return apiRequest<ClientRequest[]>("/api/requests", { token });
}

export function createRequest(payload: {
  title: string;
  description: string;
  address: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  desiredStartDate?: string;
  desiredEndDate?: string;
  budget?: number | "";
  priority: RequestPriority;
  notes?: string;
}, token: string) {
  return apiRequest<ClientRequest>("/api/requests", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export function updateRequest(payload: {
  id: string;
  status?: RequestStatus;
  priority?: RequestPriority;
  notes?: string;
  token: string;
}) {
  return apiRequest<ClientRequest>(`/api/requests/${payload.id}`, {
    method: "PATCH",
    token: payload.token,
    body: JSON.stringify({
      status: payload.status,
      priority: payload.priority,
      notes: payload.notes
    })
  });
}

export function deleteRequest(id: string, token: string) {
  return apiRequest<void>(`/api/requests/${id}`, {
    method: "DELETE",
    token
  });
}

export function convertRequest(payload: {
  id: string;
  managerId?: string;
  workStage?: string;
  plannedWorkers?: number;
  estimatedBudget?: number | "";
  token: string;
}) {
  return apiRequest<Project>(`/api/requests/${payload.id}/convert`, {
    method: "POST",
    token: payload.token,
    body: JSON.stringify({
      managerId: payload.managerId,
      workStage: payload.workStage,
      plannedWorkers: payload.plannedWorkers,
      estimatedBudget: payload.estimatedBudget
    })
  });
}

export function fetchProjects(token: string) {
  return apiRequest<Project[]>("/api/projects", { token });
}

export function createProject(payload: {
  title: string;
  description?: string;
  address: string;
  status: ProjectStatus;
  clientName?: string;
  clientPhone?: string;
  startDate?: string;
  endDate?: string;
  managerId?: string;
  clientId?: string;
  workStage?: string;
  plannedWorkers?: number;
  estimatedBudget?: number | "";
}, token: string) {
  return apiRequest<Project>("/api/projects", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export function updateProject(payload: {
  id: string;
  status?: ProjectStatus;
  managerId?: string;
  workStage?: string;
  plannedWorkers?: number;
  estimatedBudget?: number | "";
  plannedStartDate?: string;
  plannedEndDate?: string;
  managerPlanNote?: string;
  workSchedule?: WorkSchedule;
  token: string;
}) {
  return apiRequest<Project>(`/api/projects/${payload.id}`, {
    method: "PATCH",
    token: payload.token,
    body: JSON.stringify({
      status: payload.status,
      managerId: payload.managerId,
      workStage: payload.workStage,
      plannedWorkers: payload.plannedWorkers,
      estimatedBudget: payload.estimatedBudget,
      plannedStartDate: payload.plannedStartDate,
      plannedEndDate: payload.plannedEndDate,
      managerPlanNote: payload.managerPlanNote,
      workSchedule: payload.workSchedule
    })
  });
}

export function deleteProject(id: string, token: string) {
  return apiRequest<void>(`/api/projects/${id}`, {
    method: "DELETE",
    token
  });
}

export function requestProjectTeam(payload: {
  id: string;
  plannedWorkers: number;
  token: string;
}) {
  return apiRequest<Project>(`/api/projects/${payload.id}/request-team`, {
    method: "POST",
    token: payload.token,
    body: JSON.stringify({
      plannedWorkers: payload.plannedWorkers
    })
  });
}

export function submitProjectPlan(payload: {
  id: string;
  plannedStartDate: string;
  plannedEndDate: string;
  managerPlanNote?: string;
  token: string;
}) {
  return apiRequest<Project>(`/api/projects/${payload.id}/submit-plan`, {
    method: "POST",
    token: payload.token,
    body: JSON.stringify({
      plannedStartDate: payload.plannedStartDate,
      plannedEndDate: payload.plannedEndDate,
      managerPlanNote: payload.managerPlanNote
    })
  });
}

export function startProjectWork(payload: {
  id: string;
  coordinatorNote?: string;
  token: string;
}) {
  return apiRequest<Project>(`/api/projects/${payload.id}/start-work`, {
    method: "POST",
    token: payload.token,
    body: JSON.stringify({
      coordinatorNote: payload.coordinatorNote
    })
  });
}

export function completeProject(payload: {
  id: string;
  completionNote?: string;
  token: string;
}) {
  return apiRequest<Project>(`/api/projects/${payload.id}/complete`, {
    method: "POST",
    token: payload.token,
    body: JSON.stringify({
      completionNote: payload.completionNote
    })
  });
}

export function fetchDemoTime(token: string) {
  return apiRequest<{ now: string }>("/api/time", { token });
}

export function updateDemoTime(payload: { now?: string; reset?: boolean; token: string }) {
  return apiRequest<{ now: string }>("/api/time", {
    method: "PATCH",
    token: payload.token,
    body: JSON.stringify({
      now: payload.now,
      reset: payload.reset
    })
  });
}

export function fetchShifts(token: string) {
  return apiRequest<Shift[]>("/api/shifts", { token });
}

export function createShift(payload: {
  projectId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt: string;
  workersNeeded: number;
  hourlyRate: number;
  payMultiplier?: number;
  shiftHours?: number;
  estimatedShiftCount?: number | null;
  kind?: ShiftKind;
  workSchedule?: WorkSchedule;
  isWeekend?: boolean;
  isHoliday?: boolean;
  status: ShiftStatus;
}, token: string) {
  return apiRequest<Shift>("/api/shifts", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export function deleteShift(id: string, token: string) {
  return apiRequest<void>(`/api/shifts/${id}`, {
    method: "DELETE",
    token
  });
}

export function fetchUsers(token: string) {
  return apiRequest<User[]>("/api/users", { token });
}

export function fetchAbsences(token: string) {
  return apiRequest<AbsenceRequest[]>("/api/absences", { token });
}

export function createAbsence(payload: {
  projectId: string;
  assignmentId?: string;
  type: AbsenceType;
  startsAt: string;
  endsAt: string;
  reason?: string;
}, token: string) {
  return apiRequest<AbsenceRequest>("/api/absences", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export function updateAbsence(payload: {
  id: string;
  status: AbsenceStatus;
  managerNote?: string;
  token: string;
}) {
  return apiRequest<AbsenceRequest>(`/api/absences/${payload.id}`, {
    method: "PATCH",
    token: payload.token,
    body: JSON.stringify({
      status: payload.status,
      managerNote: payload.managerNote
    })
  });
}

export function createReplacementShift(absenceId: string, token: string) {
  return apiRequest<AbsenceRequest>(`/api/absences/${absenceId}/replacement`, {
    method: "POST",
    token
  });
}

export function fetchPayroll(token: string) {
  return apiRequest<PayrollRow[]>("/api/payroll", { token });
}

export function updatePayroll(payload: {
  assignmentId: string;
  payrollStatus: PayrollStatus;
  token: string;
}) {
  return apiRequest<PayrollRow>(`/api/payroll/${payload.assignmentId}`, {
    method: "PATCH",
    token: payload.token,
    body: JSON.stringify({
      payrollStatus: payload.payrollStatus
    })
  });
}

export function createPayrollDeduction(payload: {
  assignmentId: string;
  startsAt: string;
  endsAt: string;
  shiftsCount: number;
  amount?: number | "";
  reason?: string;
  token: string;
}) {
  return apiRequest<PayrollRow>(`/api/payroll/${payload.assignmentId}/deductions`, {
    method: "POST",
    token: payload.token,
    body: JSON.stringify({
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      shiftsCount: payload.shiftsCount,
      amount: payload.amount,
      reason: payload.reason
    })
  });
}

export function deletePayrollDeduction(deductionId: string, token: string) {
  return apiRequest<PayrollRow>(`/api/payroll/deductions/${deductionId}`, {
    method: "DELETE",
    token
  });
}

export function createUser(payload: {
  firstName: string;
  lastName?: string;
  phone: string;
  email?: string;
  role: UserRole;
  password: string;
  specialization?: string;
  qualification?: string;
  experienceYears?: number | "";
  isActive?: boolean;
}, token: string) {
  return apiRequest<User>("/api/users", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export function createResource(payload: {
  projectId: string;
  title: string;
  category: string;
  quantity: number;
  unit: string;
  status?: ResourceStatus;
  supplier?: string;
  estimatedCost?: number | "";
  dueDate?: string;
  notes?: string;
}, token: string) {
  return apiRequest<ResourceNeed>("/api/resources", {
    method: "POST",
    token,
    body: JSON.stringify(payload)
  });
}

export function updateResource(payload: {
  id: string;
  status?: ResourceStatus;
  supplier?: string;
  estimatedCost?: number | "";
  dueDate?: string;
  notes?: string;
  token: string;
}) {
  return apiRequest<ResourceNeed>(`/api/resources/${payload.id}`, {
    method: "PATCH",
    token: payload.token,
    body: JSON.stringify({
      status: payload.status,
      supplier: payload.supplier,
      estimatedCost: payload.estimatedCost,
      dueDate: payload.dueDate,
      notes: payload.notes
    })
  });
}

export function applyToShift(shiftId: string, token: string) {
  return apiRequest<unknown>(`/api/shifts/${shiftId}/apply`, {
    method: "POST",
    token
  });
}

export function updateAssignmentStatus(payload: {
  assignmentId: string;
  status: AssignmentStatus;
  token: string;
}) {
  return apiRequest<unknown>(`/api/assignments/${payload.assignmentId}/status`, {
    method: "PATCH",
    token: payload.token,
    body: JSON.stringify({
      status: payload.status
    })
  });
}
