import { Request, Response } from "express";
import { z } from "zod";
import { DateTime } from "luxon";
import type { HourlyReportFilters } from "../services/reports.service";
import {
  getDailyReport,
  getHourlyReport,
  getMonthlyReport,
  upsertHourlyAverages,
} from "../services/reports.service";
import { DEFAULT_TIMEZONE } from "../utils/timezone";

const decodeValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    try {
      return decodeURIComponent(value);
    } catch (_error) {
      return value;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => decodeValue(item));
  }

  return value;
};

const decodeQueryParams = (query: Request["query"]) =>
  Object.entries(query).reduce<Record<string, unknown>>(
    (accumulator, [key, value]) => {
      accumulator[key] = decodeValue(value);
      return accumulator;
    },
    {}
  );

const sensorTypeSchema = z.enum([
  "temperature",
  "humidity",
  "soil_humidity",
  "solar_radiation",
]);

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD).");

const hourlyQuerySchema = z
  .object({
    deviceId: z.string().trim().min(1, "deviceId es requerido").optional(),
    sensorType: sensorTypeSchema.optional(),
    date: isoDateSchema.optional(),
    from: z
      .string()
      .refine(
        (value) => DateTime.fromISO(value, { setZone: true }).isValid,
        "Invalid ISO datetime"
      )
      .optional(),
    to: z
      .string()
      .refine(
        (value) => DateTime.fromISO(value, { setZone: true }).isValid,
        "Invalid ISO datetime"
      )
      .optional(),
    timezone: z.string().trim().optional(),
    limit: z.coerce.number().int().positive().max(2000).optional(),
    page: z.coerce.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.date && (value.from || value.to)) {
      ctx.addIssue({
        path: ["date"],
        code: z.ZodIssueCode.custom,
        message: "Use 'date' o 'from'/'to', pero no ambos.",
      });
    }
    if ((value.from && !value.to) || (!value.from && value.to)) {
      ctx.addIssue({
        path: ["from"],
        code: z.ZodIssueCode.custom,
        message: "Debe proporcionar ambos parámetros 'from' y 'to'.",
      });
    }
  });

const dailyQuerySchema = z.object({
  deviceId: z.string().trim().min(1, "deviceId es requerido"),
  date: isoDateSchema,
  timezone: z.string().trim().optional(),
});

const monthlyQuerySchema = z.object({
  deviceId: z.string().trim().min(1, "deviceId es requerido"),
  year: z.coerce
    .number()
    .int()
    .min(2000, "El año debe ser >= 2000.")
    .max(2100, "El año debe ser <= 2100."),
  month: z.coerce
    .number()
    .int()
    .min(1, "El mes debe estar entre 1 y 12.")
    .max(12, "El mes debe estar entre 1 y 12."),
  timezone: z.string().trim().optional(),
});

const respondWithValidationError = (res: Response, error: z.ZodError) => {
  const flattened = error.flatten();
  const messages = [
    ...flattened.formErrors,
    ...Object.values(flattened.fieldErrors).flat(),
  ].filter(Boolean);
  return res.status(400).json({
    error: messages.join("; ") || "Parámetros inválidos.",
    details: flattened,
  });
};

const parseDateFromISO = (value: string, timezone: string): Date => {
  const dt = DateTime.fromISO(value, { zone: timezone });
  if (!dt.isValid) {
    throw new Error(dt.invalidReason ?? "Fecha inválida.");
  }
  return dt.toJSDate();
};

const HAS_OFFSET_REGEX = /[zZ]|[+-]\d{2}:\d{2}$/;

const parseInstantWithTimezone = (value: string, timezone: string): Date => {
  const hasExplicitOffset = HAS_OFFSET_REGEX.test(value);
  const options = hasExplicitOffset
    ? { setZone: true }
    : { zone: timezone };
  const dt = DateTime.fromISO(value, options);
  if (!dt.isValid) {
    throw new Error(dt.invalidReason ?? "Fecha inválida.");
  }
  return dt.toJSDate();
};

const hourlyRecalcSchema = z.object({
  deviceId: z.string().trim().min(1).optional(),
  sensorType: sensorTypeSchema.optional(),
  from: z
    .string()
    .refine(
      (value) => DateTime.fromISO(value, { setZone: true }).isValid,
      "Invalid ISO datetime"
    ),
  to: z
    .string()
    .refine(
      (value) => DateTime.fromISO(value, { setZone: true }).isValid,
      "Invalid ISO datetime"
    ),
  timezone: z.string().trim().optional(),
});

/**
 * Controlador para `GET /api/reports/hourly`.
 * Valida parámetros, aplica filtros y retorna las métricas horarias paginadas.
 */
export const hourlyReportHandler = async (req: Request, res: Response) => {
  const decodedQuery = decodeQueryParams(req.query);
  const result = hourlyQuerySchema.safeParse(decodedQuery);
  if (!result.success) {
    return respondWithValidationError(res, result.error);
  }

  try {
    const timezone = result.data.timezone ?? DEFAULT_TIMEZONE;
    const hourlyFilters: HourlyReportFilters = {
      deviceId: result.data.deviceId,
      sensorType: result.data.sensorType,
      timezone,
      limit: result.data.limit,
      page: result.data.page,
      date: result.data.date
        ? parseDateFromISO(result.data.date, timezone)
        : undefined,
      from:
        result.data.from && result.data.to
          ? parseInstantWithTimezone(result.data.from, timezone)
          : undefined,
      to:
        result.data.from && result.data.to
          ? parseInstantWithTimezone(result.data.to, timezone)
          : undefined,
    };

    const report = await getHourlyReport(hourlyFilters);

    return res.status(200).json(report);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Error desconocido al obtener el reporte." });
  }
};

/**
 * Controlador para `GET /api/reports/daily`.
 * Ensambla las 24 filas del día objetivo y resume extremos de temperatura,
 * humedad y radiación.
 */
export const dailyReportHandler = async (req: Request, res: Response) => {
  const decodedQuery = decodeQueryParams(req.query);
  const result = dailyQuerySchema.safeParse(decodedQuery);
  if (!result.success) {
    return respondWithValidationError(res, result.error);
  }

  const { deviceId, date, timezone } = result.data;

  try {
    const payload = await getDailyReport(
      deviceId,
      parseDateFromISO(date, timezone ?? DEFAULT_TIMEZONE),
      timezone
    );
    return res.status(200).json(payload);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Error desconocido al generar el reporte diario." });
  }
};

/**
 * Controlador para `GET /api/reports/monthly`.
 * Produce un resumen con una fila por día del mes solicitado.
 */
export const monthlyReportHandler = async (req: Request, res: Response) => {
  const decodedQuery = decodeQueryParams(req.query);
  const result = monthlyQuerySchema.safeParse(decodedQuery);
  if (!result.success) {
    return respondWithValidationError(res, result.error);
  }

  const { deviceId, year, month, timezone } = result.data;

  try {
    const payload = await getMonthlyReport(deviceId, year, month, timezone);
    return res.status(200).json(payload);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res
      .status(500)
      .json({ error: "Error desconocido al generar el reporte mensual." });
  }
};

/**
 * Controlador para `POST /api/reports/hourly/recalculate`.
 * Permite reprocesar los promedios horarios para un rango específico.
 */
export const recalculateHourlyHandler = async (req: Request, res: Response) => {
  const result = hourlyRecalcSchema.safeParse(req.body);
  if (!result.success) {
    return respondWithValidationError(res, result.error);
  }

  const { from, to, deviceId, sensorType, timezone } = result.data;

  try {
    const response = await upsertHourlyAverages({
      from: parseInstantWithTimezone(from, timezone ?? DEFAULT_TIMEZONE),
      to: parseInstantWithTimezone(to, timezone ?? DEFAULT_TIMEZONE),
      deviceId,
      sensorType,
    });
    return res.status(200).json({
      message: "Agregados horarios recalculados correctamente.",
      ...response,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({
      error: "Error desconocido al recalcular los agregados horarios.",
    });
  }
};
