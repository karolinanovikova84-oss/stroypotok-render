import { WorkSchedule } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOLIDAYS = new Set(["01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08", "02-23", "03-08", "05-01", "05-09", "06-12", "11-04"]);

function startOfDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dateKey(date: Date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function isWeekendOrHoliday(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6 || HOLIDAYS.has(dateKey(date));
}

export function countPlannedShifts(startsAt: Date, endsAt: Date, schedule: WorkSchedule) {
  if (endsAt <= startsAt) {
    return 0;
  }

  let count = 0;
  let workdayIndex = 0;
  let cursor = startOfDay(startsAt);
  const end = startOfDay(endsAt);

  while (cursor <= end) {
    if (!isWeekendOrHoliday(cursor)) {
      if (schedule === WorkSchedule.FIVE_TWO || workdayIndex % 4 < 2) {
        count += 1;
      }

      workdayIndex += 1;
    }

    cursor = new Date(cursor.getTime() + DAY_MS);
  }

  return count;
}

export function countElapsedPlannedShifts(startsAt: Date, endsAt: Date, schedule: WorkSchedule, now: Date) {
  if (now < startsAt) {
    return 0;
  }

  return countPlannedShifts(startsAt, new Date(Math.min(now.getTime(), endsAt.getTime())), schedule);
}

export function calculateRegularPay(params: {
  startsAt: Date;
  endsAt: Date;
  schedule: WorkSchedule;
  shiftHours: number;
  hourlyRate: number;
  now: Date;
}) {
  const workedShifts = countElapsedPlannedShifts(params.startsAt, params.endsAt, params.schedule, params.now);
  return {
    workedShifts,
    amount: workedShifts * params.shiftHours * params.hourlyRate
  };
}
