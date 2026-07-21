export type CardPeriod = {
  start: Date;
  end: Date;
};

export type CardPaymentDueContext = {
  dueDate: Date;
  statementCutDate: Date;
  previousStatementCutDate: Date;
  payablePeriod: CardPeriod;
  paymentPeriod: CardPeriod;
  daysUntilDue: number;
};

const MS_PER_DAY = 86400000;

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function dateWithSafeDay(year: number, month: number, day: number) {
  const safeDay = Math.min(day, daysInMonth(year, month));
  return new Date(year, month, safeDay);
}

export function getCurrentCardPeriod(cutDay: number, today = new Date()): CardPeriod {
  const normalizedToday = startOfDay(today);
  const year = normalizedToday.getFullYear();
  const month = normalizedToday.getMonth();
  const currentMonthCut = dateWithSafeDay(year, month, cutDay);

  if (normalizedToday <= currentMonthCut) {
    const previousMonth = month - 1;
    const previousCut = dateWithSafeDay(year, previousMonth, cutDay);
    const start = new Date(previousCut);
    start.setDate(previousCut.getDate() + 1);

    return {
      start,
      end: currentMonthCut,
    };
  }

  const nextMonthCut = dateWithSafeDay(year, month + 1, cutDay);
  const start = new Date(currentMonthCut);
  start.setDate(currentMonthCut.getDate() + 1);

  return {
    start,
    end: nextMonthCut,
  };
}

export function getCardPaymentDueContext(cutDay: number, paymentDueDay: number, today = new Date()): CardPaymentDueContext {
  const normalizedToday = startOfDay(today);
  const dueDate = getNextDateForDay(paymentDueDay, normalizedToday);
  // La fecha limite de pago corresponde al ultimo corte cerrado antes de esa fecha.
  const statementCutDate = getPreviousDateForDay(cutDay, dueDate);
  const previousStatementCutDate = getPreviousDateForDay(cutDay, statementCutDate);
  const payableStart = addDays(previousStatementCutDate, 1);
  const paymentStart = addDays(statementCutDate, 1);

  return {
    dueDate,
    statementCutDate,
    previousStatementCutDate,
    payablePeriod: {
      start: payableStart,
      end: statementCutDate,
    },
    paymentPeriod: {
      start: paymentStart,
      end: dueDate,
    },
    daysUntilDue: getDayDifference(normalizedToday, dueDate),
  };
}

export function getDaysUntilDay(day: number, fromDate = new Date()) {
  const today = startOfDay(fromDate);
  const target = getNextDateForDay(day, today);

  return getDayDifference(today, target);
}

export function getNextDateForDay(day: number, fromDate = new Date()) {
  const today = startOfDay(fromDate);
  const currentMonthTarget = dateWithSafeDay(today.getFullYear(), today.getMonth(), day);

  return currentMonthTarget >= today
    ? currentMonthTarget
    : dateWithSafeDay(today.getFullYear(), today.getMonth() + 1, day);
}

export function getPreviousDateForDay(day: number, beforeDate = new Date()) {
  const target = startOfDay(beforeDate);
  const currentMonthCandidate = dateWithSafeDay(target.getFullYear(), target.getMonth(), day);

  return currentMonthCandidate < target
    ? currentMonthCandidate
    : dateWithSafeDay(target.getFullYear(), target.getMonth() - 1, day);
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDayDifference(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / MS_PER_DAY);
}
