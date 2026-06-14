"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { clearStoredToken, getStoredToken } from "../lib/auth-client";
import {
  applyToShift,
  completeProject,
  convertRequest,
  createAbsence,
  createPayrollDeduction,
  createRequest,
  createResource,
  createReplacementShift,
  createShift,
  createUser,
  deleteProject,
  deletePayrollDeduction,
  deleteRequest,
  deleteShift,
  fetchCurrentUser,
  fetchAbsences,
  fetchDemoTime,
  fetchPayroll,
  fetchProjects,
  fetchRequests,
  fetchShifts,
  fetchUsers,
  startProjectWork,
  submitProjectPlan,
  updateAbsence,
  updateAssignmentStatus,
  updateDemoTime,
  updatePayroll,
  updateProject,
  updateRequest,
  updateResource,
  type AbsenceRequest,
  type AbsenceStatus,
  type AbsenceType,
  type ClientRequest,
  type CurrentUser,
  type PayrollRow,
  type PayrollStatus,
  type Project,
  type RequestPriority,
  type RequestStatus,
  type ResourceNeed,
  type ResourceStatus,
  type Shift,
  type ShiftKind,
  type User,
  type UserRole,
  type WorkSchedule
} from "../lib/api";

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Администратор",
  COORDINATOR: "Координатор",
  MANAGER: "Прораб",
  WORKER: "Рабочий",
  CLIENT: "Клиент"
};

const requestStatusLabels: Record<RequestStatus, string> = {
  NEW: "Новая",
  IN_REVIEW: "На разборе",
  ESTIMATING: "Расчет",
  APPROVED: "Согласована",
  REJECTED: "Отклонена",
  CONVERTED: "Создан объект"
};

const resourceStatusLabels: Record<ResourceStatus, string> = {
  NEEDED: "Нужно",
  ORDERED: "Заказано",
  RESERVED: "Зарезервировано",
  DELIVERED: "Доставлено",
  CANCELLED: "Отменено"
};

const workflowLabels: Record<string, string> = {
  OBJECT_CREATED: "Объект создан",
  PLANNING: "Прораб собирает план",
  PLAN_SUBMITTED: "План у координатора",
  APPROVED_TO_START: "Старт согласован",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершен"
};

const shiftKindLabels: Record<ShiftKind, string> = {
  REGULAR: "Работа на объект целиком",
  PREMIUM: "Выходная/праздничная смена",
  REPLACEMENT: "Смена на замену"
};

const workScheduleLabels: Record<WorkSchedule, string> = {
  FIVE_TWO: "5/2",
  TWO_TWO: "2/2"
};

const absenceTypeLabels: Record<AbsenceType, string> = {
  SICK_LEAVE: "Больничный",
  VACATION: "Отпуск"
};

const absenceStatusLabels: Record<AbsenceStatus, string> = {
  REQUESTED: "На рассмотрении",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
  CANCELLED: "Отменено"
};

const payrollStatusLabels: Record<PayrollStatus, string> = {
  ACCRUED: "Начислено",
  APPROVED: "Подтверждено",
  PAID: "Выплачено"
};

type PayableShift = Pick<
  Shift,
  "startsAt" | "endsAt" | "hourlyRate" | "payMultiplier" | "shiftHours" | "estimatedShiftCount" | "kind"
>;

function fullName(user?: Pick<User, "firstName" | "lastName"> | null) {
  if (!user) {
    return "Не назначен";
  }

  return `${user.firstName} ${user.lastName || ""}`.trim();
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString("ru-RU") : "не указано";
}

function toDateTimeLocalValue(value?: string | Date | null) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function numberValue(value: string | null | undefined) {
  return value ? Number(value).toLocaleString("ru-RU") : "0";
}

function formatMoney(value: number | string | null | undefined) {
  return `${Math.round(Number(value || 0)).toLocaleString("ru-RU")} ₽`;
}

const holidayKeys = new Set(["01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08", "02-23", "03-08", "05-01", "05-09", "06-12", "11-04"]);

function isWeekendOrHoliday(date: Date) {
  const day = date.getDay();
  const key = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return day === 0 || day === 6 || holidayKeys.has(key);
}

function plannedShiftCount(startsAt: string, endsAt: string, schedule: WorkSchedule) {
  if (!startsAt || !endsAt) {
    return 0;
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 0;
  }

  let count = 0;
  let workdayIndex = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const finish = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor <= finish) {
    if (!isWeekendOrHoliday(cursor)) {
      if (schedule === "FIVE_TWO" || workdayIndex % 4 < 2) {
        count += 1;
      }

      workdayIndex += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function calendarHours(shift: Pick<Shift, "startsAt" | "endsAt">) {
  const ms = new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime();
  return Math.max(0, ms / 1000 / 60 / 60);
}

function unitShiftHours(shift: PayableShift) {
  return shift.kind === "REGULAR" ? Number(shift.shiftHours || 0) : calendarHours(shift);
}

function shiftPay(shift: PayableShift) {
  if (shift.kind === "REGULAR") {
    return Number(shift.shiftHours || 0) * Number(shift.hourlyRate) * Number(shift.estimatedShiftCount || 0);
  }

  return calendarHours(shift) * Number(shift.hourlyRate) * Number(shift.payMultiplier || 1);
}

function projectTeamStats(project: Project, targetOverride?: number) {
  const regularShifts = (project.shifts || []).filter((shift) => shift.kind === "REGULAR");
  const target = targetOverride || project.plannedWorkers || regularShifts[0]?.workersNeeded || 0;
  const confirmedWorkers = new Set<string>();
  const appliedWorkers = new Set<string>();

  regularShifts.forEach((shift) => {
    (shift.assignments || []).forEach((assignment) => {
      if (assignment.status === "CONFIRMED" || assignment.status === "ATTENDED") {
        confirmedWorkers.add(assignment.workerId);
      }

      if (assignment.status === "APPLIED") {
        appliedWorkers.add(assignment.workerId);
      }
    });
  });

  const confirmedCount = confirmedWorkers.size;

  return {
    target,
    confirmedCount,
    appliedCount: appliedWorkers.size,
    progress: target > 0 ? Math.min(100, Math.round((confirmedCount / target) * 100)) : 0
  };
}

export function CabinetShell() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [absences, setAbsences] = useState<AbsenceRequest[]>([]);
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [demoNow, setDemoNow] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [managerByRequest, setManagerByRequest] = useState<Record<string, string>>({});
  const [coordinatorTab, setCoordinatorTab] = useState<"workflow" | "cleanup">("workflow");
  const [teamSizeByProject, setTeamSizeByProject] = useState<Record<string, number>>({});
  const [planByProject, setPlanByProject] = useState<Record<string, {
    plannedStartDate: string;
    plannedEndDate: string;
    managerPlanNote: string;
  }>>({});

  const [requestForm, setRequestForm] = useState({
    title: "",
    description: "",
    address: "",
    desiredStartDate: "",
    desiredEndDate: "",
    budget: "",
    priority: "NORMAL" as RequestPriority,
    notes: ""
  });

  const [userForm, setUserForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    role: "WORKER" as UserRole
  });

  const [shiftForm, setShiftForm] = useState({
    projectId: "",
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    workersNeeded: 4,
    hourlyRate: 500,
    shiftHours: 8,
    estimatedShiftCount: 10,
    kind: "REGULAR" as ShiftKind,
    workSchedule: "FIVE_TWO" as WorkSchedule,
    payMultiplier: 1,
    isWeekend: false,
    isHoliday: false
  });

  const [resourceForm, setResourceForm] = useState({
    projectId: "",
    title: "",
    category: "Материалы",
    quantity: 1,
    unit: "шт.",
    estimatedCost: "",
    notes: ""
  });

  const [absenceForm, setAbsenceForm] = useState({
    assignmentId: "",
    type: "SICK_LEAVE" as AbsenceType,
    startsAt: "",
    endsAt: "",
    reason: ""
  });

  const [completionByProject, setCompletionByProject] = useState<Record<string, string>>({});
  const [deductionForms, setDeductionForms] = useState<Record<string, {
    startsAt: string;
    endsAt: string;
    shiftsCount: number;
    amount: string;
    reason: string;
  }>>({});

  async function loadCabinet(currentToken: string) {
    const currentUser = await fetchCurrentUser(currentToken);
    const [requestRows, projectRows, shiftRows, absenceRows, payrollData, timeData] = await Promise.all([
      fetchRequests(currentToken),
      fetchProjects(currentToken),
      fetchShifts(currentToken),
      fetchAbsences(currentToken),
      fetchPayroll(currentToken),
      fetchDemoTime(currentToken)
    ]);

    const userRows = ["ADMIN", "COORDINATOR", "MANAGER"].includes(currentUser.role)
      ? await fetchUsers(currentToken)
      : [];

    setUser(currentUser);
    setRequests(requestRows);
    setProjects(projectRows);
    setShifts(shiftRows);
    setAbsences(absenceRows);
    setPayrollRows(payrollData);
    setDemoNow(toDateTimeLocalValue(timeData.now));
    setUsers(userRows);
    setShiftForm((current) => ({
      ...current,
      projectId: current.projectId || projectRows[0]?.id || ""
    }));
    setResourceForm((current) => ({
      ...current,
      projectId: current.projectId || projectRows[0]?.id || ""
    }));
    setAbsenceForm((current) => ({
      ...current,
      assignmentId:
        current.assignmentId ||
        currentUser.assignments?.find(
          (assignment) => assignment.status === "CONFIRMED" && assignment.shift.kind === "REGULAR"
        )?.id ||
        ""
    }));
  }

  useEffect(() => {
    const authToken = getStoredToken();

    if (!authToken) {
      setLoading(false);
      return;
    }

    setToken(authToken);
    loadCabinet(authToken)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить кабинет.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (shiftForm.kind !== "REGULAR") {
      return;
    }

    const calculated = plannedShiftCount(shiftForm.startsAt, shiftForm.endsAt, shiftForm.workSchedule);
    if (calculated > 0 && calculated !== shiftForm.estimatedShiftCount) {
      setShiftForm((current) => ({
        ...current,
        estimatedShiftCount: calculated
      }));
    }
  }, [shiftForm.startsAt, shiftForm.endsAt, shiftForm.workSchedule, shiftForm.kind, shiftForm.estimatedShiftCount]);

  const managers = useMemo(() => users.filter((row) => row.role === "MANAGER"), [users]);
  const workers = useMemo(() => users.filter((row) => row.role === "WORKER"), [users]);
  const pendingRequests = useMemo(
    () => requests.filter((request) => !["CONVERTED", "REJECTED"].includes(request.status)),
    [requests]
  );
  const pendingAssignments = useMemo(
    () =>
      shifts.flatMap((shift) =>
        (shift.assignments || [])
          .filter((assignment) => assignment.status === "APPLIED")
          .map((assignment) => ({ shift, assignment }))
      ),
    [shifts]
  );
  const submittedProjects = useMemo(
    () => projects.filter((project) => project.workflowStatus === "PLAN_SUBMITTED"),
    [projects]
  );
  const workerStats = useMemo(() => {
    const assignments = user?.assignments || [];
    const ownPayroll = payrollRows.filter((row) => row.worker.id === user?.id);
    const worked = assignments.filter(
      (assignment) =>
        assignment.status === "ATTENDED" || assignment.shift.status === "COMPLETED"
    );
    const confirmed = assignments.filter((assignment) =>
      ["CONFIRMED", "ATTENDED"].includes(assignment.status)
    );

    return {
      workedCount: ownPayroll.reduce((sum, row) => sum + row.workedShifts, 0) || worked.length,
      confirmedCount: confirmed.length,
      earned: ownPayroll.reduce((sum, row) => sum + (row.payrollStatus === "PAID" ? Number(row.paidAmount) : 0), 0),
      planned: ownPayroll.reduce((sum, row) => sum + Number(row.accruedAmount || 0), 0)
    };
  }, [payrollRows, user]);
  const appliedShiftIds = useMemo(
    () => new Set(user?.assignments?.map((assignment) => assignment.shift.id) || []),
    [user]
  );
  const availableShifts = useMemo(() => {
    const now = demoNow ? new Date(demoNow) : new Date();

    return shifts.filter((shift) => {
      if (shift.status === "CANCELLED" || shift.status === "COMPLETED") {
        return false;
      }

      if (shift.kind === "REGULAR") {
        return shift.project?.status !== "ACTIVE" && shift.project?.status !== "COMPLETED" && new Date(shift.startsAt) > now;
      }

      return new Date(shift.startsAt) > now;
    });
  }, [demoNow, shifts]);
  const workerAssignmentOptions = useMemo(
    () =>
      (user?.assignments || []).filter(
        (assignment) => assignment.status === "CONFIRMED" && assignment.shift.kind === "REGULAR"
      ),
    [user]
  );
  const payrollByAssignmentId = useMemo(
    () => new Map(payrollRows.map((row) => [row.id, row])),
    [payrollRows]
  );
  const workerAbsences = useMemo(
    () => absences.filter((absence) => absence.workerId === user?.id),
    [absences, user?.id]
  );
  const managerAbsences = useMemo(
    () => absences.filter((absence) => absence.status !== "CANCELLED"),
    [absences]
  );
  const demoScenarioDates = useMemo(() => {
    const project = projects.find(
      (row) => row.plannedStartDate || row.startDate || row.shifts?.[0]?.startsAt
    );
    const startValue = project?.plannedStartDate || project?.startDate || project?.shifts?.[0]?.startsAt;
    const endValue = project?.plannedEndDate || project?.endDate || project?.shifts?.[0]?.endsAt;

    if (!startValue) {
      return {
        afterStart: "",
        afterFinish: ""
      };
    }

    const afterStart = new Date(startValue);
    afterStart.setDate(afterStart.getDate() + 7);

    const afterFinish = endValue ? new Date(endValue) : new Date(afterStart);
    afterFinish.setDate(afterFinish.getDate() + 1);

    return {
      afterStart: toDateTimeLocalValue(afterStart),
      afterFinish: toDateTimeLocalValue(afterFinish)
    };
  }, [projects]);

  function logout() {
    clearStoredToken();
    router.push("/auth");
    router.refresh();
  }

  async function runAction(key: string, action: () => Promise<void>, success?: string) {
    if (!token) {
      return;
    }

    setBusyKey(key);
    setError(null);
    setMessage(null);

    try {
      await action();
      await loadCabinet(token);
      if (success) {
        setMessage(success);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Действие не выполнено.");
    } finally {
      setBusyKey(null);
    }
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      "create-request",
      async () => {
        await createRequest(
          {
            ...requestForm,
            budget: requestForm.budget ? Number(requestForm.budget) : "",
            desiredStartDate: requestForm.desiredStartDate || undefined,
            desiredEndDate: requestForm.desiredEndDate || undefined,
            notes: requestForm.notes || undefined
          },
          token!
        );
        setRequestForm({
          title: "",
          description: "",
          address: "",
          desiredStartDate: "",
          desiredEndDate: "",
          budget: "",
          priority: "NORMAL",
          notes: ""
        });
      },
      "Заявка отправлена координатору."
    );
  }

  async function submitUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      "create-user",
      async () => {
        await createUser(
          {
            ...userForm,
            lastName: userForm.lastName || undefined,
            email: userForm.email || undefined
          },
          token!
        );
        setUserForm({
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          password: "",
          role: "WORKER"
        });
      },
      "Пользователь добавлен."
    );
  }

  async function submitShift(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      "create-shift",
      async () => {
        const isPremium = shiftForm.kind === "PREMIUM";
        await createShift(
          {
            ...shiftForm,
            description: shiftForm.description || undefined,
            payMultiplier: isPremium ? shiftForm.payMultiplier : 1,
            estimatedShiftCount: isPremium ? null : shiftForm.estimatedShiftCount,
            isWeekend: isPremium ? shiftForm.isWeekend : false,
            isHoliday: isPremium ? shiftForm.isHoliday : false,
            status: "OPEN"
          },
          token!
        );
        setShiftForm((current) => ({
          ...current,
          title: "",
          description: "",
          startsAt: "",
          endsAt: "",
          workersNeeded: 4,
          hourlyRate: 500,
          shiftHours: 8,
          estimatedShiftCount: 10,
          kind: "REGULAR",
          workSchedule: "FIVE_TWO",
          payMultiplier: 1,
          isWeekend: false,
          isHoliday: false
        }));
      },
      "Вариант работы опубликован для рабочих."
    );
  }

  async function submitAbsence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const assignment = workerAssignmentOptions.find((item) => item.id === absenceForm.assignmentId);

    if (!assignment) {
      setError("Выберите объект, по которому нужно запросить отсутствие.");
      return;
    }

    await runAction(
      "create-absence",
      async () => {
        await createAbsence(
          {
            projectId: assignment.shift.project.id,
            assignmentId: assignment.id,
            type: absenceForm.type,
            startsAt: absenceForm.startsAt,
            endsAt: absenceForm.endsAt,
            reason: absenceForm.reason || undefined
          },
          token!
        );
        setAbsenceForm({
          assignmentId: "",
          type: "SICK_LEAVE",
          startsAt: "",
          endsAt: "",
          reason: ""
        });
      },
      "Запрос отправлен прорабу."
    );
  }

  async function submitResource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      "create-resource",
      async () => {
        await createResource(
          {
            ...resourceForm,
            estimatedCost: resourceForm.estimatedCost ? Number(resourceForm.estimatedCost) : ""
          },
          token!
        );
        setResourceForm((current) => ({
          ...current,
          title: "",
          quantity: 1,
          estimatedCost: "",
          notes: ""
        }));
      },
      "Ресурс добавлен в план объекта."
    );
  }

  if (loading) {
    return <div className="authShell">Загружаем кабинет...</div>;
  }

  if (!token || !user) {
    return (
      <div className="authShell">
        <h1>Нужен вход</h1>
        <p className="meta">Авторизуйтесь, чтобы система открыла рабочий стол по вашей роли.</p>
        <button className="button" onClick={() => router.push("/auth")}>
          Перейти ко входу
        </button>
      </div>
    );
  }

  const isAdmin = user.role === "ADMIN";
  const isCoordinator = user.role === "COORDINATOR";
  const isManager = user.role === "MANAGER";
  const isWorker = user.role === "WORKER";
  const isClient = user.role === "CLIENT";
  const quickLinks = [
    { href: "#overview", label: "Обзор" },
    ...((isAdmin || isCoordinator || isManager) ? [{ href: "#demo-time", label: "Демо-время" }] : []),
    ...((isClient || isAdmin) ? [{ href: "#requests", label: isClient ? "Мои заявки" : "Заявки" }] : []),
    ...((isAdmin || isCoordinator) ? [{ href: "#coordinator", label: "Координатор" }] : []),
    ...((isAdmin || isManager)
      ? [
          { href: "#manager-shifts", label: "Смены" },
          { href: "#manager-payroll", label: "Начисления" },
          { href: "#manager-absences", label: "Отсутствия" }
        ]
      : []),
    ...(isWorker
      ? [
          { href: "#worker-work", label: "Работа" },
          { href: "#worker-schedule", label: "Мои смены" },
          { href: "#worker-absences", label: "Отсутствия" }
        ]
      : []),
    ...(isAdmin ? [{ href: "#users", label: "Пользователи" }] : [])
  ];

  return (
    <>
      <section className="workspaceHero">
        <div>
          <span className="eyebrow">Рабочий стол</span>
          <h1>{roleLabels[user.role]}</h1>
          <p>
            {user.firstName} {user.lastName || ""} · {user.phone}
          </p>
        </div>
        <button className="button button--secondary" onClick={logout}>
          Выйти
        </button>
      </section>

      <nav className="quickNav" aria-label="Быстрая навигация по кабинету">
        {quickLinks.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>

      {message ? <div className="message message--ok">{message}</div> : null}
      {error ? <div className="message message--error">{error}</div> : null}

      <section id="overview" className="dashboardStrip">
        <div className="metricCard">
          <span>Заявки</span>
          <b>{requests.length}</b>
        </div>
        <div className="metricCard">
          <span>Объекты</span>
          <b>{projects.length}</b>
        </div>
        <div className="metricCard">
          <span>Смены</span>
          <b>{shifts.length}</b>
        </div>
      </section>

      {(isAdmin || isCoordinator || isManager) ? (
        <section id="demo-time" className="timePanel">
          <div>
            <span className="eyebrow">Демо-время</span>
            <p className="meta">Перемотка времени нужна, чтобы показать начисление зарплаты и блокировку записи после старта объекта.</p>
            <p className="meta">
              Активное время системы: <b>{demoNow ? formatDate(demoNow) : "реальное текущее время"}</b>
            </p>
          </div>
          <div className="toolbar">
            <input
              type="datetime-local"
              value={demoNow}
              onChange={(event) => setDemoNow(event.target.value)}
            />
            <button
              className="button button--secondary"
              onClick={() =>
                runAction(
                  "set-demo-time",
                  () => updateDemoTime({ now: demoNow, token }).then((data) => setDemoNow(toDateTimeLocalValue(data.now))),
                  "Демо-время обновлено."
                )
              }
            >
              Перемотать
            </button>
            <button
              className="button button--secondary"
              onClick={() =>
                runAction(
                  "reset-demo-time",
                  () => updateDemoTime({ reset: true, token }).then((data) => setDemoNow(toDateTimeLocalValue(data.now))),
                  "Демо-время сброшено."
                )
              }
            >
              Сбросить
            </button>
            <button
              className="button button--secondary"
              disabled={!demoScenarioDates.afterStart}
              onClick={() =>
                runAction(
                  "demo-after-start",
                  () =>
                    updateDemoTime({ now: demoScenarioDates.afterStart, token }).then((data) =>
                      setDemoNow(toDateTimeLocalValue(data.now))
                    ),
                  "Время перемотано на период выполнения объекта."
                )
              }
            >
              Старт + 7 дней
            </button>
            <button
              className="button button--secondary"
              disabled={!demoScenarioDates.afterFinish}
              onClick={() =>
                runAction(
                  "demo-after-finish",
                  () =>
                    updateDemoTime({ now: demoScenarioDates.afterFinish, token }).then((data) =>
                      setDemoNow(toDateTimeLocalValue(data.now))
                    ),
                  "Время перемотано после планового финиша объекта."
                )
              }
            >
              После финиша
            </button>
          </div>
        </section>
      ) : null}

      {(isAdmin || isManager) ? (
        <section id="manager-absences" className="split">
          <div className="tableCard">
            <h3>Больничные, отпуска и замены</h3>
            <p className="meta">Рабочий отправляет запрос по объекту, прораб подтверждает отсутствие и при необходимости публикует смену на замену.</p>
            <div className="list">
              {managerAbsences.map((absence) => (
                <div className="item" key={absence.id}>
                  <div className="item__head">
                    <h4>{absenceTypeLabels[absence.type]}: {fullName(absence.worker)}</h4>
                    <span className="status">{absenceStatusLabels[absence.status]}</span>
                  </div>
                  <div className="meta">
                    <div>Объект: {absence.project?.title || "не указан"}</div>
                    <div>Период: {formatDate(absence.startsAt)} - {formatDate(absence.endsAt)}</div>
                    <div>Основание: {absence.reason || "без комментария"}</div>
                    <div>Базовая работа: {absence.assignment?.shift.title || "не привязана"}</div>
                    <div>
                      Замена: {absence.replacementShift ? `${absence.replacementShift.title} · ${absence.replacementShift.status}` : "не создана"}
                    </div>
                  </div>
                  <div className="toolbar">
                    {absence.status === "REQUESTED" ? (
                      <>
                        <button
                          className="button"
                          disabled={busyKey === `absence-approve-${absence.id}`}
                          onClick={() =>
                            runAction(
                              `absence-approve-${absence.id}`,
                              () => updateAbsence({ id: absence.id, status: "APPROVED", token }).then(() => undefined),
                              "Отсутствие согласовано."
                            )
                          }
                        >
                          Согласовать
                        </button>
                        <button
                          className="button button--secondary"
                          disabled={busyKey === `absence-reject-${absence.id}`}
                          onClick={() =>
                            runAction(
                              `absence-reject-${absence.id}`,
                              () => updateAbsence({ id: absence.id, status: "REJECTED", token }).then(() => undefined),
                              "Запрос отклонен."
                            )
                          }
                        >
                          Отклонить
                        </button>
                      </>
                    ) : null}
                    {absence.status !== "REJECTED" && !absence.replacementShift ? (
                      <button
                        className="button button--secondary"
                        disabled={busyKey === `absence-replacement-${absence.id}`}
                        onClick={() =>
                          runAction(
                            `absence-replacement-${absence.id}`,
                            () => createReplacementShift(absence.id, token).then(() => undefined),
                            "Смена на замену опубликована для рабочих."
                          )
                        }
                      >
                        Создать смену на замену
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {managerAbsences.length === 0 ? <div className="item">Запросов на отсутствие пока нет.</div> : null}
            </div>
          </div>

          <div id="manager-payroll" className="tableCard">
            <h3>Зарплата и начисления</h3>
            <p className="meta">Сумма начисляется по демо-времени: для обычной работы учитываются прошедшие рабочие дни по графику, для повышенных смен - завершенная смена.</p>
            <div className="list">
              {payrollRows.map((row) => {
                const deductionForm = deductionForms[row.id] || {
                  startsAt: toDateTimeLocalValue(row.shift.startsAt),
                  endsAt: toDateTimeLocalValue(row.shift.endsAt),
                  shiftsCount: 1,
                  amount: "",
                  reason: ""
                };

                return (
                <div className="item" key={row.id}>
                  <div className="item__head">
                    <h4>{fullName(row.worker)}</h4>
                    <span className="status">{payrollStatusLabels[row.payrollStatus]}</span>
                  </div>
                  <div className="meta">
                    <div>Объект: {row.shift.project.title}</div>
                    <div>Работа: {row.shift.title}</div>
                    <div>График: {workScheduleLabels[row.shift.workSchedule]} · отработано {row.workedShifts}/{row.scheduledShifts} смен</div>
                    <div>Грязными: {formatMoney(row.grossAmount)} · вычеты: {formatMoney(row.deductionAmount)} · к выплате: {formatMoney(row.accruedAmount)}</div>
                    <div>Выплачено: {formatMoney(row.paidAmount)}</div>
                  </div>
                  <div className="managerTools">
                    <h4>Ручной вычет за невыход</h4>
                    <p className="meta">Больничные и отпуска остаются оплачиваемыми. Этот блок нужен для ручного вычета, если рабочий не вышел на смену без оплачиваемого основания.</p>
                    <div className="formGrid">
                      <div className="field">
                        <label htmlFor={`deduction-start-${row.id}`}>Начало периода</label>
                        <input
                          id={`deduction-start-${row.id}`}
                          type="datetime-local"
                          value={deductionForm.startsAt}
                          onChange={(event) =>
                            setDeductionForms((current) => ({
                              ...current,
                              [row.id]: {
                                ...deductionForm,
                                startsAt: event.target.value
                              }
                            }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`deduction-end-${row.id}`}>Конец периода</label>
                        <input
                          id={`deduction-end-${row.id}`}
                          type="datetime-local"
                          value={deductionForm.endsAt}
                          onChange={(event) =>
                            setDeductionForms((current) => ({
                              ...current,
                              [row.id]: {
                                ...deductionForm,
                                endsAt: event.target.value
                              }
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="formGrid">
                      <div className="field">
                        <label htmlFor={`deduction-count-${row.id}`}>Сколько смен вычесть</label>
                        <input
                          id={`deduction-count-${row.id}`}
                          type="number"
                          min={1}
                          value={deductionForm.shiftsCount}
                          onChange={(event) =>
                            setDeductionForms((current) => ({
                              ...current,
                              [row.id]: {
                                ...deductionForm,
                                shiftsCount: Number(event.target.value || 1)
                              }
                            }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`deduction-amount-${row.id}`}>Сумма вычета</label>
                        <input
                          id={`deduction-amount-${row.id}`}
                          type="number"
                          min={0}
                          placeholder="Авто по ставке"
                          value={deductionForm.amount}
                          onChange={(event) =>
                            setDeductionForms((current) => ({
                              ...current,
                              [row.id]: {
                                ...deductionForm,
                                amount: event.target.value
                              }
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor={`deduction-reason-${row.id}`}>Причина</label>
                      <textarea
                        id={`deduction-reason-${row.id}`}
                        value={deductionForm.reason}
                        onChange={(event) =>
                          setDeductionForms((current) => ({
                            ...current,
                            [row.id]: {
                              ...deductionForm,
                              reason: event.target.value
                            }
                          }))
                        }
                        placeholder="Например: не вышел на объект 18 июня, подтверждения больничного нет"
                      />
                    </div>
                    <button
                      className="button button--secondary"
                      disabled={busyKey === `deduction-${row.id}`}
                      onClick={() =>
                        runAction(
                          `deduction-${row.id}`,
                          async () => {
                            await createPayrollDeduction(
                              {
                                assignmentId: row.id,
                                startsAt: deductionForm.startsAt,
                                endsAt: deductionForm.endsAt,
                                shiftsCount: deductionForm.shiftsCount,
                                amount: deductionForm.amount ? Number(deductionForm.amount) : "",
                                reason: deductionForm.reason || undefined,
                                token
                              }
                            );
                            setDeductionForms((current) => ({
                              ...current,
                              [row.id]: {
                                ...deductionForm,
                                amount: "",
                                reason: ""
                              }
                            }));
                          },
                          "Вычет добавлен, сумма к выплате пересчитана."
                        )
                      }
                    >
                      Добавить вычет
                    </button>
                    {(row.payrollDeductions || []).map((deduction) => (
                      <div className="subItem" key={deduction.id}>
                        <span>
                          {formatDate(deduction.startsAt)} - {formatDate(deduction.endsAt)} · {deduction.shiftsCount} смен · {formatMoney(deduction.amount)}
                          {deduction.reason ? ` · ${deduction.reason}` : ""}
                        </span>
                        <button
                          className="textButton"
                          onClick={() =>
                            runAction(
                              `deduction-delete-${deduction.id}`,
                              () => deletePayrollDeduction(deduction.id, token).then(() => undefined),
                              "Вычет удален, зарплата пересчитана."
                            )
                          }
                        >
                          Удалить
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="toolbar">
                    <button
                      className="button button--secondary"
                      disabled={row.payrollStatus !== "ACCRUED" || busyKey === `payroll-approve-${row.id}`}
                      onClick={() =>
                        runAction(
                          `payroll-approve-${row.id}`,
                          () => updatePayroll({ assignmentId: row.id, payrollStatus: "APPROVED", token }).then(() => undefined),
                          "Начисление подтверждено."
                        )
                      }
                    >
                      Подтвердить
                    </button>
                    <button
                      className="button"
                      disabled={row.payrollStatus === "PAID" || busyKey === `payroll-paid-${row.id}`}
                      onClick={() =>
                        runAction(
                          `payroll-paid-${row.id}`,
                          () => updatePayroll({ assignmentId: row.id, payrollStatus: "PAID", token }).then(() => undefined),
                          "Зарплата отмечена как выплаченная."
                        )
                      }
                    >
                      Выплатить
                    </button>
                  </div>
                </div>
                );
              })}
              {payrollRows.length === 0 ? <div className="item">Подтвержденных рабочих для начислений пока нет.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {isWorker ? (
        <section className="dashboardStrip">
          <div className="metricCard">
            <span>Отработано смен</span>
            <b>{workerStats.workedCount}</b>
          </div>
          <div className="metricCard">
            <span>Начислено</span>
            <b>{Math.round(workerStats.earned).toLocaleString("ru-RU")} ₽</b>
          </div>
          <div className="metricCard">
            <span>Плановая сумма</span>
            <b>{Math.round(workerStats.planned).toLocaleString("ru-RU")} ₽</b>
          </div>
        </section>
      ) : null}

      {(isClient || isAdmin) ? (
        <section id="requests" className="split">
          <div className="formCard">
            <h3>Заявка клиента</h3>
            <p className="meta">Клиент описывает объект, сроки, бюджет и состав работ.</p>
            <form className="stack" onSubmit={submitRequest}>
              <div className="field">
                <label htmlFor="request-title">Название</label>
                <input
                  id="request-title"
                  value={requestForm.title}
                  onChange={(event) => setRequestForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ремонт коммерческого помещения"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="request-address">Адрес объекта</label>
                <input
                  id="request-address"
                  value={requestForm.address}
                  onChange={(event) => setRequestForm((current) => ({ ...current, address: event.target.value }))}
                  placeholder="Москва, ул. Строителей, 12"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="request-description">Описание работ</label>
                <textarea
                  id="request-description"
                  value={requestForm.description}
                  onChange={(event) => setRequestForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Что нужно сделать, какие зоны, ограничения, желаемый результат"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="request-priority">Приоритет</label>
                <select
                  id="request-priority"
                  value={requestForm.priority}
                  onChange={(event) => setRequestForm((current) => ({ ...current, priority: event.target.value as RequestPriority }))}
                >
                  <option value="LOW">Низкий</option>
                  <option value="NORMAL">Обычный</option>
                  <option value="HIGH">Высокий</option>
                  <option value="URGENT">Срочный</option>
                </select>
              </div>
              <div className="formGrid">
                <div className="field">
                  <label htmlFor="request-start">Желаемый старт</label>
                  <input
                    id="request-start"
                    type="date"
                    value={requestForm.desiredStartDate}
                    onChange={(event) => setRequestForm((current) => ({ ...current, desiredStartDate: event.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="request-budget">Бюджет</label>
                  <input
                    id="request-budget"
                    type="number"
                    min={0}
                    value={requestForm.budget}
                    onChange={(event) => setRequestForm((current) => ({ ...current, budget: event.target.value }))}
                    placeholder="250000"
                  />
                </div>
              </div>
              <button className="button" disabled={busyKey === "create-request"}>
                Отправить заявку
              </button>
            </form>
          </div>

          <div className="tableCard">
            <h3>{isClient ? "Мои заявки и объекты" : "Клиентские заявки"}</h3>
            <div className="list">
              {requests.map((request) => (
                <div className="item" key={request.id}>
                  <div className="item__head">
                    <h4>{request.title}</h4>
                    <span className="status">{requestStatusLabels[request.status]}</span>
                  </div>
                  <div className="meta">
                    <div>Адрес: {request.address}</div>
                    <div>Приоритет: {request.priority}</div>
                    <div>Создана: {formatDate(request.createdAt)}</div>
                    {request.project ? <div>Объект: {request.project.title}</div> : null}
                  </div>
                </div>
              ))}
              {requests.length === 0 ? <div className="item">Заявок пока нет.</div> : null}
            </div>
            {isClient ? (
              <>
                <div className="divider" />
                <h3>Уведомления по объектам</h3>
                <div className="list">
                  {(user.clientProjects || []).map((project) => (
                    <div className="item" key={project.id}>
                      <div className="item__head">
                        <h4>{project.title}</h4>
                        <span className="status">{workflowLabels[project.workflowStatus || ""] || project.status}</span>
                      </div>
                      <div className="meta">
                        <div>Адрес: {project.address}</div>
                        <div>Сроки: {formatDate(project.plannedStartDate)} - {formatDate(project.plannedEndDate)}</div>
                        <div>Ответственный: {fullName(project.manager)}</div>
                        <div>Последнее уведомление: {project.clientNotifiedAt ? formatDate(project.clientNotifiedAt) : "пока не отправлялось"}</div>
                        <div>{project.clientNotice || "Координатор еще не дал старт работам."}</div>
                      </div>
                      <div className="miniTimeline">
                        <span className="miniTimeline__step miniTimeline__step--done">Объект создан</span>
                        <span className={`miniTimeline__step ${["PLAN_SUBMITTED", "APPROVED_TO_START", "IN_PROGRESS", "COMPLETED"].includes(project.workflowStatus || "") ? "miniTimeline__step--done" : ""}`}>
                          План собран
                        </span>
                        <span className={`miniTimeline__step ${project.clientNotifiedAt ? "miniTimeline__step--done" : ""}`}>
                          Клиент уведомлен
                        </span>
                        <span className={`miniTimeline__step ${project.workflowStatus === "COMPLETED" ? "miniTimeline__step--done" : ""}`}>
                          Объект завершен
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {(isAdmin || isCoordinator) ? (
        <section id="coordinator" className="workspaceSection">
          <div className="sectionHead">
            <div>
              <h2>Кабинет координатора</h2>
              <p>Основной сценарий ведет заявку до старта работ, а временная вкладка очистки помогает быстро пересобрать демо с нуля.</p>
            </div>
          </div>
          <div className="tabBar">
            <button
              className={`tabButton ${coordinatorTab === "workflow" ? "tabButton--active" : ""}`}
              onClick={() => setCoordinatorTab("workflow")}
            >
              Рабочий процесс
            </button>
            <button
              className={`tabButton ${coordinatorTab === "cleanup" ? "tabButton--active" : ""}`}
              onClick={() => setCoordinatorTab("cleanup")}
            >
              Очистка данных
            </button>
          </div>

          {coordinatorTab === "workflow" ? (
            <>
              <div className="sectionHead">
                <div>
                  <h2>Диспетчеризация заявок</h2>
                  <p>Координатор принимает заявку, назначает прораба и запускает объект в работу.</p>
                </div>
              </div>
              <div className="list">
                {pendingRequests.map((request) => (
                  <div className="item" key={request.id}>
                    <div className="item__head">
                      <h4>{request.title}</h4>
                      <span className="status">{requestStatusLabels[request.status]}</span>
                    </div>
                    <div className="meta">
                      <div>Клиент: {request.clientName} · {request.clientPhone}</div>
                      <div>Адрес: {request.address}</div>
                      <div>Бюджет: {numberValue(request.budget)} ₽</div>
                    </div>
                    <div className="toolbar">
                      <select
                        className="inlineSelect"
                        value={managerByRequest[request.id] || ""}
                        onChange={(event) =>
                          setManagerByRequest((current) => ({ ...current, [request.id]: event.target.value }))
                        }
                      >
                        <option value="">Прораб не назначен</option>
                        {managers.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {fullName(manager)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="button button--secondary"
                        disabled={busyKey === `request-review-${request.id}`}
                        onClick={() =>
                          runAction(
                            `request-review-${request.id}`,
                            () => updateRequest({ id: request.id, status: "ESTIMATING", token }).then(() => undefined),
                            "Заявка отправлена на расчет."
                          )
                        }
                      >
                        На расчет
                      </button>
                      <button
                        className="button"
                        disabled={busyKey === `convert-${request.id}`}
                        onClick={() =>
                          runAction(
                            `convert-${request.id}`,
                            () =>
                              convertRequest({
                                id: request.id,
                                managerId: managerByRequest[request.id] || undefined,
                                workStage: "Ожидает план прораба",
                                plannedWorkers: 6,
                                token
                              }).then(() => undefined),
                            "Заявка превращена в объект. Дальше прораб соберет команду и ресурсы."
                          )
                        }
                      >
                        Создать объект
                      </button>
                    </div>
                  </div>
                ))}
                {pendingRequests.length === 0 ? <div className="item">Нет заявок, ожидающих обработки.</div> : null}
              </div>

              <div className="sectionHead">
                <div>
                  <h2>Планы от прорабов</h2>
                  <p>Координатор проверяет команду, сроки и ресурсы, затем дает старт работам.</p>
                </div>
              </div>

              <div className="list">
                {submittedProjects.map((project) => (
                  <div className="item" key={project.id}>
                    <div className="item__head">
                      <h4>{project.title}</h4>
                      <span className="status">{workflowLabels[project.workflowStatus || ""] || project.workflowStatus}</span>
                    </div>
                    <div className="meta">
                      <div>Прораб: {fullName(project.manager)}</div>
                      <div>Сроки: {formatDate(project.plannedStartDate)} - {formatDate(project.plannedEndDate)}</div>
                      <div>Команда: {project.teamReadyAt ? "собрана" : "не подтверждена"}</div>
                      <div>Ресурсы: {(project.resources || []).length} позиций</div>
                      <div>Комментарий прораба: {project.managerPlanNote || "нет"}</div>
                    </div>
                    {(project.resources || []).map((resource) => (
                      <div className="subItem" key={resource.id}>
                        <span>{resource.title} · {resource.quantity} {resource.unit}</span>
                        <b>{resourceStatusLabels[resource.status]}</b>
                      </div>
                    ))}
                    <div className="toolbar">
                      <button
                        className="button"
                        disabled={busyKey === `start-${project.id}`}
                        onClick={() =>
                          runAction(
                            `start-${project.id}`,
                            () =>
                              startProjectWork({
                                id: project.id,
                                coordinatorNote: "Старт согласован координатором",
                                token
                              }).then(() => undefined),
                            "Старт работ согласован, клиент получил уведомление."
                          )
                        }
                      >
                        Дать старт работам
                      </button>
                    </div>
                  </div>
                ))}
                {submittedProjects.length === 0 ? <div className="item">Пока нет планов на согласование.</div> : null}
              </div>
            </>
          ) : (
            <>
              <div className="sectionHead">
                <div>
                  <h2>Очистка данных</h2>
                  <p>Временный инструмент для подготовки защиты: можно удалить тестовые заявки, объекты и смены перед созданием сценария с нуля.</p>
                </div>
              </div>
              <div className="split">
                <div className="tableCard">
                  <h3>Заявки</h3>
                  <div className="list">
                    {requests.map((request) => (
                      <div className="item" key={request.id}>
                        <div className="item__head">
                          <h4>{request.title}</h4>
                          <span className="status">{requestStatusLabels[request.status]}</span>
                        </div>
                        <div className="meta">
                          <div>Клиент: {request.clientName} · {request.clientPhone}</div>
                          <div>Адрес: {request.address}</div>
                          <div>{request.project ? `Связанный объект: ${request.project.title}` : "Объект еще не создан"}</div>
                        </div>
                        <button
                          className="button button--danger"
                          disabled={busyKey === `delete-request-${request.id}`}
                          onClick={() => {
                            if (!window.confirm(`Удалить заявку "${request.title}"? Если по ней уже есть объект, он тоже будет удален.`)) {
                              return;
                            }

                            runAction(
                              `delete-request-${request.id}`,
                              () => deleteRequest(request.id, token).then(() => undefined),
                              "Заявка удалена."
                            );
                          }}
                        >
                          Удалить заявку
                        </button>
                      </div>
                    ))}
                    {requests.length === 0 ? <div className="item">Заявок пока нет.</div> : null}
                  </div>
                </div>

                <div className="tableCard">
                  <h3>Объекты</h3>
                  <div className="list">
                    {projects.map((project) => (
                      <div className="item" key={project.id}>
                        <div className="item__head">
                          <h4>{project.title}</h4>
                          <span className="status">{workflowLabels[project.workflowStatus || ""] || project.status}</span>
                        </div>
                        <div className="meta">
                          <div>Адрес: {project.address}</div>
                          <div>Прораб: {fullName(project.manager)}</div>
                          <div>Смен: {project._count?.shifts ?? 0} · ресурсов: {project._count?.resources ?? 0}</div>
                        </div>
                        <button
                          className="button button--danger"
                          disabled={busyKey === `delete-project-${project.id}`}
                          onClick={() => {
                            if (!window.confirm(`Удалить объект "${project.title}" вместе со сменами, назначениями и ресурсами?`)) {
                              return;
                            }

                            runAction(
                              `delete-project-${project.id}`,
                              () => deleteProject(project.id, token).then(() => undefined),
                              "Объект удален."
                            );
                          }}
                        >
                          Удалить объект
                        </button>
                      </div>
                    ))}
                    {projects.length === 0 ? <div className="item">Объектов пока нет.</div> : null}
                  </div>
                </div>
              </div>

              <div className="tableCard">
                <h3>Смены и работа на объектах</h3>
                <div className="list">
                  {shifts.map((shift) => (
                    <div className="item" key={shift.id}>
                      <div className="item__head">
                        <h4>{shift.title}</h4>
                        <span className="status">{shiftKindLabels[shift.kind]}</span>
                      </div>
                      <div className="meta">
                        <div>Объект: {shift.project?.title}</div>
                        <div>Период: {formatDate(shift.startsAt)} - {formatDate(shift.endsAt)}</div>
                        <div>Откликов/назначений: {shift._count?.assignments ?? shift.assignments?.length ?? 0}</div>
                      </div>
                      <button
                        className="button button--danger"
                        disabled={busyKey === `delete-shift-${shift.id}`}
                        onClick={() => {
                          if (!window.confirm(`Удалить "${shift.title}" и все отклики рабочих?`)) {
                            return;
                          }

                          runAction(
                            `delete-shift-${shift.id}`,
                            () => deleteShift(shift.id, token).then(() => undefined),
                            "Смена удалена."
                          );
                        }}
                      >
                        Удалить смену
                      </button>
                    </div>
                  ))}
                  {shifts.length === 0 ? <div className="item">Смен пока нет.</div> : null}
                </div>
              </div>
            </>
          )}
        </section>
      ) : null}

      {(isAdmin || isManager) ? (
        <section id="manager-shifts" className="split">
          <div className="formCard">
            <h3>Работа на объекте</h3>
            <p className="meta">Обычный вариант означает запись рабочего на весь объект. Отдельные смены создаются только для выходных или праздников.</p>
            <form className="stack" onSubmit={submitShift}>
              <div className="field">
                <label htmlFor="shift-project">Объект</label>
                <select
                  id="shift-project"
                  value={shiftForm.projectId}
                  onChange={(event) => setShiftForm((current) => ({ ...current, projectId: event.target.value }))}
                  required
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="shift-title">Название работы</label>
                <input
                  id="shift-title"
                  value={shiftForm.title}
                  onChange={(event) => setShiftForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Демонтаж перегородок"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="shift-description">Задача и условия</label>
                <textarea
                  id="shift-description"
                  value={shiftForm.description}
                  onChange={(event) => setShiftForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Участок, состав работ, требования к выходу"
                />
              </div>
              <div className="formGrid">
                <div className="field">
                  <label htmlFor="shift-start">{shiftForm.kind === "REGULAR" ? "Старт объекта" : "Начало смены"}</label>
                  <input
                    id="shift-start"
                    type="datetime-local"
                    value={shiftForm.startsAt}
                    onChange={(event) => setShiftForm((current) => ({ ...current, startsAt: event.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="shift-end">{shiftForm.kind === "REGULAR" ? "Финиш объекта" : "Конец смены"}</label>
                  <input
                    id="shift-end"
                    type="datetime-local"
                    value={shiftForm.endsAt}
                    onChange={(event) => setShiftForm((current) => ({ ...current, endsAt: event.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="formGrid">
                <div className="field">
                  <label htmlFor="shift-workers">{shiftForm.kind === "REGULAR" ? "Людей в бригаду" : "Людей на смену"}</label>
                  <input
                    id="shift-workers"
                    type="number"
                    min={1}
                    value={shiftForm.workersNeeded}
                    onChange={(event) => setShiftForm((current) => ({ ...current, workersNeeded: Number(event.target.value || 0) }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="shift-rate">Ставка/час</label>
                  <input
                    id="shift-rate"
                    type="number"
                    min={1}
                    value={shiftForm.hourlyRate}
                    onChange={(event) => setShiftForm((current) => ({ ...current, hourlyRate: Number(event.target.value || 0) }))}
                  />
                </div>
              </div>
              <div className="formGrid">
                <div className="field">
                  <label htmlFor="shift-hours">Часов в одной смене</label>
                  <input
                    id="shift-hours"
                    type="number"
                    min={1}
                    max={24}
                    step={0.5}
                    value={shiftForm.shiftHours}
                    onChange={(event) => setShiftForm((current) => ({ ...current, shiftHours: Number(event.target.value || 0) }))}
                  />
                </div>
                {shiftForm.kind === "REGULAR" ? (
                  <div className="field">
                    <label htmlFor="shift-estimated-count">Расчетное количество смен</label>
                    <input
                      id="shift-estimated-count"
                      type="number"
                      min={1}
                      value={shiftForm.estimatedShiftCount}
                      onChange={(event) =>
                        setShiftForm((current) => ({
                          ...current,
                          estimatedShiftCount: Number(event.target.value || 0)
                        }))
                      }
                    />
                  </div>
                ) : null}
              </div>
              {shiftForm.kind === "REGULAR" ? (
                <div className="formGrid">
                  <div className="field">
                    <label htmlFor="shift-schedule">График работ</label>
                    <select
                      id="shift-schedule"
                      value={shiftForm.workSchedule}
                      onChange={(event) =>
                        setShiftForm((current) => ({
                          ...current,
                          workSchedule: event.target.value as WorkSchedule
                        }))
                      }
                    >
                      <option value="FIVE_TWO">5/2 без выходных и праздников</option>
                      <option value="TWO_TWO">2/2 по рабочим дням, без выходных и праздников</option>
                    </select>
                  </div>
                  <div className="metricCard metricCard--compact">
                    <span>Авторасчет смен</span>
                    <b>{shiftForm.estimatedShiftCount}</b>
                    <small>{workScheduleLabels[shiftForm.workSchedule]} за выбранный период</small>
                  </div>
                </div>
              ) : null}
              <div className="field">
                <label htmlFor="shift-kind">Тип работы</label>
                <select
                  id="shift-kind"
                  value={shiftForm.kind}
                  onChange={(event) =>
                    setShiftForm((current) => ({
                      ...current,
                      kind: event.target.value as ShiftKind,
                      payMultiplier: event.target.value === "PREMIUM" ? Math.max(current.payMultiplier, 1.5) : 1,
                      isWeekend: event.target.value === "PREMIUM" ? true : false,
                      isHoliday: false
                    }))
                  }
                >
                  <option value="REGULAR">Работа на объект целиком</option>
                  <option value="PREMIUM">Выходной/праздник с коэффициентом</option>
                </select>
              </div>
              {shiftForm.kind === "PREMIUM" ? (
                <div className="formGrid">
                  <div className="field">
                    <label htmlFor="shift-multiplier">Коэффициент</label>
                    <input
                      id="shift-multiplier"
                      type="number"
                      min={1}
                      max={5}
                      step={0.1}
                      value={shiftForm.payMultiplier}
                      onChange={(event) =>
                        setShiftForm((current) => ({
                          ...current,
                          payMultiplier: Number(event.target.value || 1)
                        }))
                      }
                    />
                  </div>
                  <label className="checkField">
                    <input
                      type="checkbox"
                      checked={shiftForm.isWeekend}
                      onChange={(event) =>
                        setShiftForm((current) => ({ ...current, isWeekend: event.target.checked }))
                      }
                    />
                    Выходной
                  </label>
                  <label className="checkField">
                    <input
                      type="checkbox"
                      checked={shiftForm.isHoliday}
                      onChange={(event) =>
                        setShiftForm((current) => ({ ...current, isHoliday: event.target.checked }))
                      }
                    />
                    Праздник
                  </label>
                </div>
              ) : null}
              <button className="button" disabled={!shiftForm.projectId || busyKey === "create-shift"}>
                {shiftForm.kind === "REGULAR" ? "Опубликовать работу на объект" : "Опубликовать повышенную смену"}
              </button>
            </form>
          </div>

          <div className="tableCard">
            <h3>Объекты и ресурсы</h3>
            <div className="list">
              {projects.map((project) => {
                const teamStats = projectTeamStats(project, teamSizeByProject[project.id]);
                const plannedWorkers = teamSizeByProject[project.id] || project.plannedWorkers || teamStats.target || 4;

                return (
                <div className="item" key={project.id}>
                  <div className="item__head">
                    <h4>{project.title}</h4>
                    <span className="status">{project.status}</span>
                  </div>
                  <div className="meta">
                    <div>Адрес: {project.address}</div>
                    <div>Прораб: {fullName(project.manager)}</div>
                    <div>Этап: {project.workStage || "не указан"}</div>
                    <div>Процесс: {workflowLabels[project.workflowStatus || ""] || "объект создан"}</div>
                    <div>График: {workScheduleLabels[project.workSchedule || "FIVE_TWO"]}</div>
                    <div>Бригада: {teamStats.confirmedCount}/{teamStats.target || plannedWorkers} подтверждено</div>
                    <div>Смен: {project._count?.shifts ?? 0} · ресурсов: {project._count?.resources ?? 0}</div>
                  </div>
                  {isManager || isAdmin ? (
                    <div className="managerTools">
                      <div className="teamProgress">
                        <div className="teamProgress__head">
                          <div>
                            <span>Набор бригады</span>
                            <p>{teamStats.appliedCount > 0 ? `${teamStats.appliedCount} отклик(ов) ждут решения` : "Новых откликов пока нет"}</p>
                          </div>
                          <b>{teamStats.confirmedCount}/{teamStats.target || plannedWorkers}</b>
                        </div>
                        <div className="teamProgress__bar" aria-label={`Собрано ${teamStats.confirmedCount} из ${teamStats.target || plannedWorkers}`}>
                          <span style={{ width: `${teamStats.progress}%` }} />
                        </div>
                      </div>
                      <div className="formGrid">
                        <div className="field">
                          <label htmlFor={`team-${project.id}`}>Сколько рабочих нужно</label>
                          <input
                            id={`team-${project.id}`}
                            type="number"
                            min={1}
                            value={plannedWorkers}
                            onChange={(event) =>
                              setTeamSizeByProject((current) => ({
                                ...current,
                                [project.id]: Number(event.target.value || 1)
                              }))
                            }
                            onBlur={() => {
                              if (!teamSizeByProject[project.id] || teamSizeByProject[project.id] === project.plannedWorkers) {
                                return;
                              }

                              runAction(
                                `team-size-${project.id}`,
                                () =>
                                  updateProject({
                                    id: project.id,
                                    plannedWorkers: teamSizeByProject[project.id],
                                    token
                                  }).then(() => undefined),
                                "Плановая численность бригады обновлена."
                              );
                            }}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`plan-start-${project.id}`}>Старт работ</label>
                          <input
                            id={`plan-start-${project.id}`}
                            type="date"
                            value={planByProject[project.id]?.plannedStartDate || project.plannedStartDate?.slice(0, 10) || ""}
                            onChange={(event) =>
                              setPlanByProject((current) => ({
                                ...current,
                                [project.id]: {
                                  plannedStartDate: event.target.value,
                                  plannedEndDate: current[project.id]?.plannedEndDate || "",
                                  managerPlanNote: current[project.id]?.managerPlanNote || ""
                                }
                              }))
                            }
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`plan-end-${project.id}`}>Финиш работ</label>
                          <input
                            id={`plan-end-${project.id}`}
                            type="date"
                            value={planByProject[project.id]?.plannedEndDate || project.plannedEndDate?.slice(0, 10) || ""}
                            onChange={(event) =>
                              setPlanByProject((current) => ({
                                ...current,
                                [project.id]: {
                                  plannedStartDate: current[project.id]?.plannedStartDate || "",
                                  plannedEndDate: event.target.value,
                                  managerPlanNote: current[project.id]?.managerPlanNote || ""
                                }
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor={`plan-note-${project.id}`}>Комментарий к плану</label>
                        <textarea
                          id={`plan-note-${project.id}`}
                          value={planByProject[project.id]?.managerPlanNote || project.managerPlanNote || ""}
                          onChange={(event) =>
                            setPlanByProject((current) => ({
                              ...current,
                              [project.id]: {
                                plannedStartDate: current[project.id]?.plannedStartDate || "",
                                plannedEndDate: current[project.id]?.plannedEndDate || "",
                                managerPlanNote: event.target.value
                              }
                            }))
                          }
                          placeholder="Команда собрана, ресурсы заказаны, можно запускать объект"
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="toolbar">
                    {(isManager || isAdmin) ? (
                      <button
                        className="button"
                        disabled={
                          busyKey === `submit-plan-${project.id}` ||
                          ["PLAN_SUBMITTED", "IN_PROGRESS", "COMPLETED"].includes(project.workflowStatus || "")
                        }
                        onClick={() =>
                          runAction(
                            `submit-plan-${project.id}`,
                            async () => {
                              const updatedPlannedWorkers = teamSizeByProject[project.id];

                              if (updatedPlannedWorkers && updatedPlannedWorkers !== project.plannedWorkers) {
                                await updateProject({
                                  id: project.id,
                                  plannedWorkers: updatedPlannedWorkers,
                                  token
                                });
                              }

                              await submitProjectPlan({
                                id: project.id,
                                plannedStartDate: planByProject[project.id]?.plannedStartDate || project.plannedStartDate?.slice(0, 10) || "",
                                plannedEndDate: planByProject[project.id]?.plannedEndDate || project.plannedEndDate?.slice(0, 10) || "",
                                managerPlanNote: planByProject[project.id]?.managerPlanNote || project.managerPlanNote || undefined,
                                token
                              });
                            },
                            "План отправлен координатору."
                          )
                        }
                      >
                        {project.workflowStatus === "PLAN_SUBMITTED"
                          ? "План ожидает координатора"
                          : project.workflowStatus === "IN_PROGRESS"
                            ? "Работы уже начались"
                            : project.workflowStatus === "COMPLETED"
                              ? "Объект завершен"
                              : "Передать план координатору"}
                      </button>
                    ) : null}
                  </div>
                  {project.workflowStatus === "IN_PROGRESS" ? (
                    <div className="managerTools">
                      <div className="field">
                        <label htmlFor={`completion-${project.id}`}>Комментарий к завершению объекта</label>
                        <textarea
                          id={`completion-${project.id}`}
                          value={completionByProject[project.id] || ""}
                          onChange={(event) =>
                            setCompletionByProject((current) => ({
                              ...current,
                              [project.id]: event.target.value
                            }))
                          }
                          placeholder="Работы выполнены, замечания закрыты, можно закрывать объект"
                        />
                      </div>
                      <button
                        className="button button--secondary"
                        disabled={busyKey === `complete-${project.id}`}
                        onClick={() =>
                          runAction(
                            `complete-${project.id}`,
                            () =>
                              completeProject({
                                id: project.id,
                                completionNote: completionByProject[project.id] || undefined,
                                token
                              }).then(() => undefined),
                            "Объект завершен, клиент получил уведомление."
                          )
                        }
                      >
                        Завершить объект
                      </button>
                    </div>
                  ) : null}
                  {(project.resources || []).map((resource) => (
                    <div className="subItem" key={resource.id}>
                      <span>{resource.title}</span>
                      <button
                        className="textButton"
                        onClick={() =>
                          runAction(
                            `resource-${resource.id}`,
                            () =>
                              updateResource({
                                id: resource.id,
                                status: resource.status === "DELIVERED" ? "NEEDED" : "DELIVERED",
                                token
                              }).then(() => undefined),
                            "Статус ресурса обновлен."
                          )
                        }
                      >
                        {resourceStatusLabels[resource.status]}
                      </button>
                    </div>
                  ))}
                </div>
                );
              })}
              {projects.length === 0 ? <div className="item">Объекты появятся после обработки заявок.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {(isAdmin || isManager) ? (
        <section className="split">
          <div className="formCard">
            <h3>Ресурс объекта</h3>
            <form className="stack" onSubmit={submitResource}>
              <div className="field">
                <label htmlFor="resource-project">Объект</label>
                <select
                  id="resource-project"
                  value={resourceForm.projectId}
                  onChange={(event) => setResourceForm((current) => ({ ...current, projectId: event.target.value }))}
                  required
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="resource-title">Что нужно</label>
                <input
                  id="resource-title"
                  value={resourceForm.title}
                  onChange={(event) => setResourceForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Леса строительные"
                  required
                />
              </div>
              <div className="formGrid">
                <div className="field">
                  <label htmlFor="resource-quantity">Количество</label>
                  <input
                    id="resource-quantity"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={resourceForm.quantity}
                    onChange={(event) => setResourceForm((current) => ({ ...current, quantity: Number(event.target.value || 0) }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="resource-unit">Ед.</label>
                  <input
                    id="resource-unit"
                    value={resourceForm.unit}
                    onChange={(event) => setResourceForm((current) => ({ ...current, unit: event.target.value }))}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="resource-notes">Примечание</label>
                <textarea
                  id="resource-notes"
                  value={resourceForm.notes}
                  onChange={(event) => setResourceForm((current) => ({ ...current, notes: event.target.value }))}
                />
              </div>
              <button className="button" disabled={!resourceForm.projectId || busyKey === "create-resource"}>
                Добавить ресурс
              </button>
            </form>
          </div>

          <div className="tableCard">
            <h3>Отклики рабочих</h3>
            <div className="list">
              {pendingAssignments.map(({ shift, assignment }) => (
                <div className="item" key={assignment.id}>
                  <div className="item__head">
                    <h4>{shift.title}</h4>
                    <span className="status">{assignment.status}</span>
                  </div>
                  <div className="meta">
                    <div>Рабочий: {fullName(assignment.worker)} · {assignment.worker?.phone}</div>
                    <div>Объект: {shift.project?.title}</div>
                    <div>Начало: {formatDate(shift.startsAt)}</div>
                  </div>
                  <div className="toolbar">
                    <button
                      className="button"
                      onClick={() =>
                        runAction(
                          `assignment-${assignment.id}-confirm`,
                          () => updateAssignmentStatus({ assignmentId: assignment.id, status: "CONFIRMED", token }).then(() => undefined),
                          "Рабочий подтвержден на смену."
                        )
                      }
                    >
                      Подтвердить
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() =>
                        runAction(
                          `assignment-${assignment.id}-reject`,
                          () => updateAssignmentStatus({ assignmentId: assignment.id, status: "REJECTED", token }).then(() => undefined),
                          "Отклик отклонен."
                        )
                      }
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              ))}
              {pendingAssignments.length === 0 ? <div className="item">Новых откликов пока нет.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {isWorker ? (
        <section id="worker-work" className="split">
          <div className="tableCard">
            <h3>Доступная работа</h3>
            <div className="list">
              {availableShifts.map((shift) => {
                const alreadyApplied = appliedShiftIds.has(shift.id);
                const isObjectWork = shift.kind === "REGULAR";
                return (
                  <div className="item" key={shift.id}>
                    <div className="item__head">
                      <h4>{shift.title}</h4>
                      <span className="status">{shift.status}</span>
                    </div>
                    <div className="meta">
                      <div>Объект: {shift.project?.title}</div>
                      <div>Адрес: {shift.project?.address}</div>
                      <div>{isObjectWork ? "Период объекта" : "Время смены"}: {formatDate(shift.startsAt)} - {formatDate(shift.endsAt)}</div>
                      <div>
                        Ставка: {Number(shift.hourlyRate).toLocaleString("ru-RU")} ₽/час
                        {isObjectWork ? "" : ` · коэффициент ${Number(shift.payMultiplier || 1)}`}
                      </div>
                      <div>
                        Тип: {shiftKindLabels[shift.kind]} · часов в смене: {unitShiftHours(shift).toLocaleString("ru-RU")}
                      </div>
                      <div>График: {workScheduleLabels[shift.workSchedule]}</div>
                      {isObjectWork ? (
                        <div>
                          Примерно смен: {shift.estimatedShiftCount || 0} · расчет за объект: {Math.round(shiftPay(shift)).toLocaleString("ru-RU")} ₽
                        </div>
                      ) : (
                        <div>
                          Повышенная смена: {shift.isHoliday ? "праздник" : "выходной"} · расчет за смену: {Math.round(shiftPay(shift)).toLocaleString("ru-RU")} ₽
                        </div>
                      )}
                    </div>
                    <button
                      className="button"
                      disabled={alreadyApplied || busyKey === `apply-${shift.id}`}
                      onClick={() =>
                        runAction(
                          `apply-${shift.id}`,
                          () => applyToShift(shift.id, token).then(() => undefined),
                          "Отклик отправлен прорабу."
                        )
                      }
                    >
                      {alreadyApplied ? "Отклик отправлен" : isObjectWork ? "Записаться на объект" : "Откликнуться на смену"}
                    </button>
                  </div>
                );
              })}
              {availableShifts.length === 0 ? <div className="item">Открытой работы пока нет или запись уже закрыта после старта объекта.</div> : null}
            </div>
          </div>

          <div id="worker-schedule" className="tableCard">
            <h3>Мои назначения</h3>
            <div className="list">
              {(user.assignments || []).map((assignment) => {
                const isObjectWork = assignment.shift.kind === "REGULAR";
                const payroll = payrollByAssignmentId.get(assignment.id);
                const now = demoNow ? new Date(demoNow) : new Date();
                const hasStarted = now >= new Date(assignment.shift.startsAt);
                const hasFinished = now >= new Date(assignment.shift.endsAt) || assignment.status === "ATTENDED";
                const scheduleState =
                  assignment.status === "APPLIED"
                    ? "Отклик ожидает прораба"
                    : hasFinished
                      ? "Отработано"
                      : hasStarted
                        ? "В процессе"
                        : "Предстоит";
                return (
                  <div className="item" key={assignment.id}>
                    <div className="item__head">
                      <h4>{assignment.shift.title}</h4>
                      <span className="status">{scheduleState}</span>
                    </div>
                    <div className="meta">
                      <div>Объект: {assignment.shift.project.title}</div>
                      <div>Адрес: {assignment.shift.project.address}</div>
                      <div>{isObjectWork ? "Период работ" : "Смена"}: {formatDate(assignment.shift.startsAt)} - {formatDate(assignment.shift.endsAt)}</div>
                      <div>
                        {isObjectWork ? "Плановая сумма за объект" : "Сумма смены"}: {Math.round(shiftPay(assignment.shift)).toLocaleString("ru-RU")} ₽
                        {isObjectWork ? ` · ${assignment.shift.estimatedShiftCount || 0} смен по ${Number(assignment.shift.shiftHours || 0)} ч` : ` · коэффициент ${Number(assignment.shift.payMultiplier || 1)}`}
                      </div>
                      <div>График: {workScheduleLabels[assignment.shift.workSchedule]} · статус отклика: {assignment.status}</div>
                      {payroll?.deductionAmount ? (
                        <div>Вычеты за невыход: {formatMoney(payroll.deductionAmount)} · начислено до вычетов: {formatMoney(payroll.grossAmount)}</div>
                      ) : null}
                      <div>
                        Табель: {payroll ? `${payroll.workedShifts}/${payroll.scheduledShifts} смен` : "будет после подтверждения"}
                        {payroll ? ` · предстоит ${Math.max(0, payroll.scheduledShifts - payroll.workedShifts)} смен` : ""} · начислено: {formatMoney(payroll?.accruedAmount)} · выплачено: {formatMoney(payroll?.paidAmount)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {(user.assignments || []).length === 0 ? <div className="item">Назначений пока нет.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {isWorker ? (
        <section id="worker-absences" className="split">
          <div className="formCard">
            <h3>Запросить больничный или отпуск</h3>
            <p className="meta">Запрос уходит прорабу выбранного объекта. После согласования он сможет создать смену на замену.</p>
            <form className="stack" onSubmit={submitAbsence}>
              <div className="field">
                <label htmlFor="absence-assignment">Объект</label>
                <select
                  id="absence-assignment"
                  value={absenceForm.assignmentId}
                  onChange={(event) => setAbsenceForm((current) => ({ ...current, assignmentId: event.target.value }))}
                  required
                >
                  <option value="">Выберите подтвержденный объект</option>
                  {workerAssignmentOptions.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.shift.project.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="absence-type">Тип отсутствия</label>
                <select
                  id="absence-type"
                  value={absenceForm.type}
                  onChange={(event) => setAbsenceForm((current) => ({ ...current, type: event.target.value as AbsenceType }))}
                >
                  <option value="SICK_LEAVE">Больничный</option>
                  <option value="VACATION">Отпуск</option>
                </select>
              </div>
              <div className="formGrid">
                <div className="field">
                  <label htmlFor="absence-start">Начало</label>
                  <input
                    id="absence-start"
                    type="datetime-local"
                    value={absenceForm.startsAt}
                    onChange={(event) => setAbsenceForm((current) => ({ ...current, startsAt: event.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="absence-end">Конец</label>
                  <input
                    id="absence-end"
                    type="datetime-local"
                    value={absenceForm.endsAt}
                    onChange={(event) => setAbsenceForm((current) => ({ ...current, endsAt: event.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="absence-reason">Комментарий</label>
                <textarea
                  id="absence-reason"
                  value={absenceForm.reason}
                  onChange={(event) => setAbsenceForm((current) => ({ ...current, reason: event.target.value }))}
                  placeholder="Например: больничный лист, семейные обстоятельства, заранее согласованный отпуск"
                />
              </div>
              <button className="button" disabled={!absenceForm.assignmentId || busyKey === "create-absence"}>
                Отправить запрос
              </button>
            </form>
          </div>

          <div className="tableCard">
            <h3>Мои отсутствия</h3>
            <div className="list">
              {workerAbsences.map((absence) => (
                <div className="item" key={absence.id}>
                  <div className="item__head">
                    <h4>{absenceTypeLabels[absence.type]}</h4>
                    <span className="status">{absenceStatusLabels[absence.status]}</span>
                  </div>
                  <div className="meta">
                    <div>Объект: {absence.project?.title || "не указан"}</div>
                    <div>Период: {formatDate(absence.startsAt)} - {formatDate(absence.endsAt)}</div>
                    <div>Комментарий прораба: {absence.managerNote || "пока нет"}</div>
                    <div>Замена: {absence.replacementShift ? "смена опубликована" : "не требуется или еще не создана"}</div>
                  </div>
                </div>
              ))}
              {workerAbsences.length === 0 ? <div className="item">Запросов на больничный или отпуск пока нет.</div> : null}
            </div>
          </div>
        </section>
      ) : null}

      {isAdmin ? (
        <section id="users" className="split">
          <div className="formCard">
            <h3>Админ-панель пользователей</h3>
            <form className="stack" onSubmit={submitUser}>
              <div className="field">
                <label htmlFor="user-first">Имя</label>
                <input
                  id="user-first"
                  value={userForm.firstName}
                  onChange={(event) => setUserForm((current) => ({ ...current, firstName: event.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="user-phone">Телефон</label>
                <input
                  id="user-phone"
                  value={userForm.phone}
                  onChange={(event) => setUserForm((current) => ({ ...current, phone: event.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="user-password">Пароль</label>
                <input
                  id="user-password"
                  type="password"
                  value={userForm.password}
                  onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="user-role">Роль</label>
                <select
                  id="user-role"
                  value={userForm.role}
                  onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value as UserRole }))}
                >
                  <option value="ADMIN">Администратор</option>
                  <option value="COORDINATOR">Координатор</option>
                  <option value="MANAGER">Прораб</option>
                  <option value="WORKER">Рабочий</option>
                  <option value="CLIENT">Клиент</option>
                </select>
              </div>
              <button className="button" disabled={busyKey === "create-user"}>
                Создать пользователя
              </button>
            </form>
          </div>

          <div className="tableCard">
            <h3>Пользователи системы</h3>
            <div className="list">
              {users.map((row) => (
                <div className="item" key={row.id}>
                  <div className="item__head">
                    <h4>{fullName(row)}</h4>
                    <span className="status">{roleLabels[row.role]}</span>
                  </div>
                  <div className="meta">
                    <div>Телефон: {row.phone}</div>
                    <div>Email: {row.email || "не указан"}</div>
                    <div>Активен: {row.isActive ? "да" : "нет"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
