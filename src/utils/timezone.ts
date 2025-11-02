const DEFAULT_TIMEZONE = "America/Bogota";

const baseFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: DEFAULT_TIMEZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  if (timeZone === DEFAULT_TIMEZONE) {
    return baseFormatter;
  }

  const existing = formatterCache.get(timeZone);
  if (existing) return existing;

  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  formatterCache.set(timeZone, formatter);
  return formatter;
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const utcDate = new Date(
    date.toLocaleString("en-US", { timeZone: "UTC", hour12: false })
  );
  const tzDate = new Date(
    date.toLocaleString("en-US", { timeZone, hour12: false })
  );
  return (tzDate.getTime() - utcDate.getTime()) / 60000;
}

function buildOffsetString(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, "0");
  const minutes = String(absoluteMinutes % 60).padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function partsToISOString(
  parts: Intl.DateTimeFormatPart[],
  milliseconds: number
): string {
  const data = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const fraction = String(milliseconds).padStart(3, "0");

  return `${data.year}-${data.month}-${data.day}T${data.hour}:${data.minute}:${data.second}.${fraction}`;
}

export function toZonedISOString(
  value: Date | string,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  if (!value) throw new Error("El valor de fecha es obligatorio.");

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("El valor recibido no es una fecha válida.");
  }

  const formatter = getFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const offsetMinutes = getTimeZoneOffsetMinutes(date, timeZone);
  const offset = buildOffsetString(offsetMinutes);

  return `${partsToISOString(parts, date.getMilliseconds())}${offset}`;
}

export { DEFAULT_TIMEZONE };
