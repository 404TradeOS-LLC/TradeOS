export interface ForecastPeriodCandidate {
  name?: string;
  startTime?: string;
  endTime?: string;
  isDaytime?: boolean;
  temperature?: number;
  temperatureUnit?: string;
  shortForecast?: string;
  probabilityOfPrecipitation?: { value?: number | null };
}

function toValidDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isUsablePeriod(period: ForecastPeriodCandidate | undefined): period is ForecastPeriodCandidate & {
  name: string;
  temperature: number;
  shortForecast: string;
} {
  return !!period && typeof period.temperature === "number" && typeof period.shortForecast === "string" && typeof period.name === "string";
}

export function selectRelevantForecastPeriod(
  periods: ForecastPeriodCandidate[] | undefined,
  now = new Date()
): (ForecastPeriodCandidate & { name: string; temperature: number; shortForecast: string }) | null {
  if (!periods?.length) return null;

  const usablePeriods = periods.filter(isUsablePeriod);
  if (usablePeriods.length === 0) return null;

  const current = usablePeriods.find((period) => {
    const start = toValidDate(period.startTime);
    const end = toValidDate(period.endTime);
    if (!start || !end) return false;
    return now >= start && now < end;
  });

  if (current) return current;

  const nextFuture = usablePeriods.find((period) => {
    const start = toValidDate(period.startTime);
    return start ? start >= now : false;
  });

  return nextFuture ?? usablePeriods[0];
}
