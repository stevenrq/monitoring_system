import { PipelineStage, FilterQuery } from "mongoose";
import { DateTime } from "luxon";
import SensorDataModel from "../models/sensor-data.model";
import HourlyAverageModel, {
  IHourlyAverage,
  IHourlyAverageDocument,
} from "../models/hourly-average.model";
import { DEFAULT_TIMEZONE } from "../utils/timezone";

const REPORT_TIMEZONE = DEFAULT_TIMEZONE;
const HOURS_IN_DAY = 24;
const MAX_HOURLY_RANGE_DAYS = 92;
const DEFAULT_DECIMALS = 2;

type SensorType =
  | "temperature"
  | "humidity"
  | "soil_humidity"
  | "solar_radiation";

interface HourlyAggregationResult {
  deviceId: string;
  sensorType: SensorType;
  hour: Date;
  avg: number;
  min: number;
  max: number;
  samples: number;
  units: string;
}

export interface UpsertHourlyParams {
  from: Date;
  to: Date;
  deviceId?: string;
  sensorType?: SensorType;
}

export interface HourlyReportFilters {
  deviceId?: string;
  sensorType?: SensorType;
  from?: Date;
  to?: Date;
  date?: Date;
  timezone?: string;
  limit?: number;
  page?: number;
}

export interface HourlyReportEntry {
  deviceId: string;
  sensorType: SensorType;
  hour: string;
  avg: number;
  min: number;
  max: number;
  samples: number;
  units: string;
}

export interface HourlyReportResult {
  data: HourlyReportEntry[];
  pagination: {
    total: number;
    limit: number;
    page: number;
    pages: number;
  };
}

export interface DailyReportRow {
  hour: number;
  solar_radiation_avg?: number;
  humidity_avg?: number;
  temperature_avg?: number;
  isTmax?: boolean;
  isTmin?: boolean;
}

export interface DailyReportPayload {
  deviceId: string;
  date: string;
  rows: DailyReportRow[];
  temperature: { tmax?: number; tmin?: number; tpro?: number };
  humidity: { hpro?: number };
  radiation: { radTot?: number; radPro?: number; radMax?: number };
}

export interface MonthlyDay {
  day: number;
  RadTot?: number;
  RadPro?: number;
  RadMax?: number;
  HR?: number;
  Tmax?: number;
  Tmin?: number;
  Tpro?: number;
}

export interface MonthlyReportPayload {
  deviceId: string;
  year: number;
  month: number;
  days: MonthlyDay[];
}

type HourlyAverageRecord = Pick<
  IHourlyAverage,
  "deviceId" | "sensorType" | "hour" | "avg" | "min" | "max" | "samples" | "units"
>;

const ensureRangeIsValid = (from: Date, to: Date) => {
  if (from >= to) {
    throw new Error("El rango de fechas es inválido: 'from' debe ser < 'to'.");
  }

  const start = DateTime.fromJSDate(from);
  const end = DateTime.fromJSDate(to);
  const diff = end.diff(start, "days").days;

  if (diff > MAX_HOURLY_RANGE_DAYS) {
    throw new Error(
      `El rango máximo permitido es de ${MAX_HOURLY_RANGE_DAYS} días.`
    );
  }
};

const getTimezone = (value?: string): string =>
  value && value.trim().length > 0 ? value : REPORT_TIMEZONE;

const buildHourlyAggregationPipeline = (
  params: UpsertHourlyParams
): PipelineStage[] => {
  const matchStage: Record<string, unknown> = {
    timestamp: { $gte: params.from, $lt: params.to },
  };

  if (params.deviceId) {
    matchStage.deviceId = params.deviceId;
  }

  if (params.sensorType) {
    matchStage.sensorType = params.sensorType;
  }

  return [
    { $match: matchStage },
    {
      $addFields: {
        hour: {
          $dateTrunc: {
            date: "$timestamp",
            unit: "hour",
            timezone: REPORT_TIMEZONE,
          },
        },
      },
    },
    {
      $group: {
        _id: {
          deviceId: "$deviceId",
          sensorType: "$sensorType",
          hour: "$hour",
          unit: "$unit",
        },
        avg: { $avg: "$value" },
        min: { $min: "$value" },
        max: { $max: "$value" },
        samples: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        deviceId: "$_id.deviceId",
        sensorType: "$_id.sensorType",
        hour: "$_id.hour",
        avg: "$avg",
        min: "$min",
        max: "$max",
        samples: "$samples",
        units: "$_id.unit",
      },
    },
    {
      $sort: { hour: 1, deviceId: 1, sensorType: 1 },
    },
  ];
};

const toZonedISO = (value: Date, zone: string): string => {
  const iso = DateTime.fromJSDate(value, { zone })
    .set({ millisecond: 0 })
    .toISO({ suppressMilliseconds: true });
  if (!iso) {
    throw new Error("No se pudo formatear la fecha en la zona solicitada.");
  }
  return iso;
};

const computeRangeFromDate = (date: Date, zone: string) => {
  const dt = DateTime.fromJSDate(date, { zone }).startOf("day");
  return {
    from: dt.toJSDate(),
    to: dt.plus({ days: 1 }).toJSDate(),
  };
};

const roundNumber = (value: number, decimals: number = DEFAULT_DECIMALS) =>
  Number(value.toFixed(decimals));

const roundMetric = (
  value: number | undefined,
  decimals: number = DEFAULT_DECIMALS
): number | undefined => {
  if (typeof value !== "number") return undefined;
  return roundNumber(value, decimals);
};

const normalizeHourlyFilters = (
  filters: HourlyReportFilters
): {
  query: FilterQuery<IHourlyAverageDocument>;
  timezone: string;
  limit: number;
  skip: number;
  page: number;
  from?: Date;
  to?: Date;
} => {
  const timezone = getTimezone(filters.timezone);
  const query: FilterQuery<IHourlyAverageDocument> = {};

  if (filters.deviceId) {
    query.deviceId = filters.deviceId;
  }

  if (filters.sensorType) {
    query.sensorType = filters.sensorType;
  }

  let from: Date | undefined;
  let to: Date | undefined;

  if (filters.date) {
    const range = computeRangeFromDate(filters.date, timezone);
    from = range.from;
    to = range.to;
  } else if (filters.from && filters.to) {
    ensureRangeIsValid(filters.from, filters.to);
    from = filters.from;
    to = filters.to;
  } else if (filters.from || filters.to) {
    throw new Error(
      "Debe proveer ambos parámetros 'from' y 'to' o usar 'date'."
    );
  }

  if (from && to) {
    query.hour = { $gte: from, $lt: to };
  }

  const limit = filters.limit && filters.limit > 0 ? filters.limit : 500;
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const skip = (page - 1) * limit;

  return { query, timezone, limit, skip, page, from, to };
};

/**
 * Calcula y persiste las métricas horarias ({@link HourlyAverageModel}) de lecturas crudas
 * para un rango de tiempo proporcionado. El proceso es idempotente gracias al upsert sobre
 * la llave `{ deviceId, sensorType, hour }`.
 *
 * @param params - Parámetros que incluyen el rango de fechas y filtros opcionales.
 * @returns Un objeto con la cantidad de documentos insertados o actualizados.
 * @throws Error si el rango excede el máximo permitido o es inválido.
 */
export const upsertHourlyAverages = async (
  params: UpsertHourlyParams
): Promise<{ upserted: number }> => {
  ensureRangeIsValid(params.from, params.to);

  const pipeline = buildHourlyAggregationPipeline(params);

  const aggregated =
    await SensorDataModel.aggregate<HourlyAggregationResult>(pipeline);

  if (!aggregated.length) {
    return { upserted: 0 };
  }

  const now = new Date();

  const bulkOps = aggregated.map((item) => ({
    updateOne: {
      filter: {
        deviceId: item.deviceId,
        sensorType: item.sensorType,
        hour: item.hour,
      },
      update: {
        $set: {
          avg: item.avg,
          min: item.min,
          max: item.max,
          samples: item.samples,
          units: item.units,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      upsert: true,
    },
  }));

  const result = await HourlyAverageModel.bulkWrite(bulkOps, {
    ordered: false,
  });

  const upserted = (result.upsertedCount ?? 0) + (result.modifiedCount ?? 0);
  return { upserted };
};

/**
 * Ejecuta `explain()` sobre el pipeline de agregación horaria, útil para inspeccionar su plan.
 *
 * @param params - Parámetros de rango para la inspección.
 * @returns El resultado de `explain()` de MongoDB.
 */
export const explainHourlyAggregation = async (
  params: UpsertHourlyParams
): Promise<unknown> => {
  ensureRangeIsValid(params.from, params.to);
  const pipeline = buildHourlyAggregationPipeline(params);
  return SensorDataModel.aggregate(pipeline).explain();
};

/**
 * Recupera métricas horarias ya calculadas, aplicando filtros por dispositivo, sensor
 * y rango de fechas. Incluye metadatos de paginación.
 *
 * @param filters - Filtros disponibles para la consulta.
 * @returns Los registros horarios junto con información de paginación.
 */
export const getHourlyReport = async (
  filters: HourlyReportFilters
): Promise<HourlyReportResult> => {
  const { query, timezone, limit, skip, page } =
    normalizeHourlyFilters(filters);

  const [rawDocs, total] = await Promise.all([
    HourlyAverageModel.find(query)
      .sort({ hour: 1, deviceId: 1, sensorType: 1 })
      .skip(skip)
      .limit(limit)
      .lean<HourlyAverageRecord>()
      .exec(),
    HourlyAverageModel.countDocuments(query),
  ]);

  const docs = rawDocs as unknown as HourlyAverageRecord[];

  const data = docs.map((doc) => ({
    deviceId: doc.deviceId,
    sensorType: doc.sensorType as SensorType,
    hour: toZonedISO(doc.hour, timezone),
    avg: roundNumber(doc.avg),
    min: roundNumber(doc.min),
    max: roundNumber(doc.max),
    samples: doc.samples,
    units: doc.units,
  }));

  const pages = Math.max(1, Math.ceil(total / limit));

  return {
    data,
    pagination: {
      total,
      limit,
      page,
      pages,
    },
  };
};

const initializeDailyRows = (): DailyReportRow[] =>
  Array.from({ length: HOURS_IN_DAY }, (_value, index) => ({
    hour: index,
  }));

const computeAverage = (values: number[]): number | undefined => {
  if (!values.length) return undefined;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
};

const markTemperatureExtremes = (
  rows: DailyReportRow[],
  tmax?: number,
  tmin?: number
) => {
  if (typeof tmax === "number") {
    rows
      .filter((row) => row.temperature_avg === tmax)
      .forEach((row) => {
        row.isTmax = true;
      });
  }

  if (typeof tmin === "number") {
    rows
      .filter((row) => row.temperature_avg === tmin)
      .forEach((row) => {
        row.isTmin = true;
      });
  }
};

/**
 * Construye el reporte diario para un dispositivo a partir de los promedios horarios,
 * generando 24 filas (una por hora) y las métricas agregadas pedidas por negocio.
 *
 * @param deviceId - Identificador del dispositivo.
 * @param date - Fecha objetivo (se tomará la zona horaria configurada).
 * @param timezone - Zona horaria opcional, por defecto America/Bogota.
 * @returns El payload completo del reporte diario listo para la API.
 */
export const getDailyReport = async (
  deviceId: string,
  date: Date,
  timezone?: string
): Promise<DailyReportPayload> => {
  const tz = getTimezone(timezone);
  const { from, to } = computeRangeFromDate(date, tz);

  const rawDocs = await HourlyAverageModel.find({
    deviceId,
    hour: { $gte: from, $lt: to },
  })
    .sort({ hour: 1 })
    .lean<HourlyAverageRecord>()
    .exec();

  const docs = rawDocs as unknown as HourlyAverageRecord[];

  const rows = initializeDailyRows();

  docs.forEach((doc) => {
    const dt = DateTime.fromJSDate(doc.hour, { zone: tz });
    const hourIndex = dt.hour;
    const row = rows[hourIndex];

    switch (doc.sensorType) {
      case "temperature":
        row.temperature_avg = roundMetric(doc.avg);
        break;
      case "humidity":
        row.humidity_avg = roundMetric(doc.avg);
        break;
      case "solar_radiation":
        row.solar_radiation_avg = roundMetric(doc.avg);
        break;
      default:
        break;
    }
  });

  const temperatureValues = rows
    .map((row) => row.temperature_avg)
    .filter((value): value is number => typeof value === "number");
  const humidityValues = rows
    .map((row) => row.humidity_avg)
    .filter((value): value is number => typeof value === "number");
  const radiationValues = rows
    .map((row) => row.solar_radiation_avg)
    .filter((value): value is number => typeof value === "number");

  const tmax =
    temperatureValues.length > 0 ? Math.max(...temperatureValues) : undefined;
  const tmin =
    temperatureValues.length > 0 ? Math.min(...temperatureValues) : undefined;
  const tpro = computeAverage(temperatureValues);
  const hpro = computeAverage(humidityValues);
  const radTot =
    radiationValues.length > 0
      ? radiationValues.reduce((acc, value) => acc + value, 0)
      : undefined;
  const radPro = computeAverage(radiationValues);
  const radMax =
    radiationValues.length > 0 ? Math.max(...radiationValues) : undefined;

  markTemperatureExtremes(rows, tmax, tmin);

  return {
    deviceId,
    date: DateTime.fromJSDate(from, { zone: tz })
      .startOf("day")
      .toISODate() as string,
    rows,
    temperature: {
      tmax: roundMetric(tmax),
      tmin: roundMetric(tmin),
      tpro: roundMetric(tpro),
    },
    humidity: { hpro: roundMetric(hpro) },
    radiation: {
      radTot: roundMetric(radTot),
      radPro: roundMetric(radPro),
      radMax: roundMetric(radMax),
    },
  };
};

/**
 * Genera el reporte mensual agregando por día las métricas requeridas (temperatura,
 * humedad y radiación) a partir de los registros horarios.
 *
 * @param deviceId - Identificador del dispositivo.
 * @param year - Año numérico (YYYY).
 * @param month - Mes (1-12).
 * @param timezone - Zona horaria opcional, por defecto America/Bogota.
 * @returns El resumen mensual con una fila por día.
 */
export const getMonthlyReport = async (
  deviceId: string,
  year: number,
  month: number,
  timezone?: string
): Promise<MonthlyReportPayload> => {
  const tz = getTimezone(timezone);

  const startOfMonth = DateTime.fromObject(
    { year, month, day: 1 },
    { zone: tz }
  ).startOf("day");
  const endOfMonth = startOfMonth.plus({ months: 1 });

  const rawDocs = await HourlyAverageModel.find({
    deviceId,
    hour: { $gte: startOfMonth.toJSDate(), $lt: endOfMonth.toJSDate() },
  })
    .sort({ hour: 1 })
    .lean<HourlyAverageRecord>()
    .exec();

  const docs = rawDocs as unknown as HourlyAverageRecord[];

  const daysInMonth = startOfMonth.daysInMonth;
  if (!daysInMonth) {
    throw new Error("No se pudo determinar la cantidad de días del mes.");
  }
  const dayBuckets = new Map<number, { [key in SensorType]?: number[] }>();

  docs.forEach((doc) => {
    const dt = DateTime.fromJSDate(doc.hour, { zone: tz });
    const dayNumber = dt.day;
    if (!dayBuckets.has(dayNumber)) {
      dayBuckets.set(dayNumber, {});
    }
    const bucket = dayBuckets.get(dayNumber)!;
    if (!bucket[doc.sensorType as SensorType]) {
      bucket[doc.sensorType as SensorType] = [];
    }
    bucket[doc.sensorType as SensorType]!.push(doc.avg);
  });

  const days: MonthlyDay[] = Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = index + 1;
    const bucket = dayBuckets.get(dayNumber);

    const temperatureValues = bucket?.temperature ?? [];
    const humidityValues = bucket?.humidity ?? [];
    const radiationValues = bucket?.solar_radiation ?? [];

    const Tmax =
      temperatureValues.length > 0 ? Math.max(...temperatureValues) : undefined;
    const Tmin =
      temperatureValues.length > 0 ? Math.min(...temperatureValues) : undefined;
    const Tpro = computeAverage(temperatureValues);
    const HR = computeAverage(humidityValues);
    const RadTot =
      radiationValues.length > 0
        ? radiationValues.reduce((acc, value) => acc + value, 0)
        : undefined;
    const RadPro = computeAverage(radiationValues);
    const RadMax =
      radiationValues.length > 0 ? Math.max(...radiationValues) : undefined;

    return {
      day: dayNumber,
      RadTot: roundMetric(RadTot),
      RadPro: roundMetric(RadPro),
      RadMax: roundMetric(RadMax),
      HR: roundMetric(HR),
      Tmax: roundMetric(Tmax),
      Tmin: roundMetric(Tmin),
      Tpro: roundMetric(Tpro),
    };
  });

  return {
    deviceId,
    year,
    month,
    days,
  };
};
