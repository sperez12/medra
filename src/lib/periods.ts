export type CardPeriod = {
  start: Date;
  end: Date;
};

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function dateWithSafeDay(year: number, month: number, day: number) {
  const safeDay = Math.min(day, daysInMonth(year, month));
  return new Date(year, month, safeDay);
}

export function getCurrentCardPeriod(cutDay: number, today = new Date()): CardPeriod {
  const year = today.getFullYear();
  const month = today.getMonth();
  const currentMonthCut = dateWithSafeDay(year, month, cutDay);

  if (today <= currentMonthCut) {
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
