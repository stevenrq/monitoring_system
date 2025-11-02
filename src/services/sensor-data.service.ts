import { PipelineStage } from "mongoose";
import SensorData, { ISensorDataDocument } from "../models/sensor-data.model";
import { DEFAULT_TIMEZONE, toZonedISOString } from "../utils/timezone";

/**
 * Representa la última lectura registrada de un sensor.
 */
export interface LatestSensorReading {
  deviceId: string;
  sensorType: string;
  value: number;
  unit: string;
  timestamp: string;
  timestampUtc: string;
}

interface LatestSensorReadingRaw
  extends Omit<LatestSensorReading, "timestamp" | "timestampUtc"> {
  timestamp: Date;
  timestampLocal?: string;
}

/**
 * Filtros aplicables a los reportes y consultas de datos de sensores.
 */
export interface SensorReportFilters {
  deviceId?: string;
  sensorType?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

/**
 * Representa una entrada del reporte estadístico de sensores.
 */
export interface SensorReportEntry {
  deviceId: string;
  sensorType: string;
  unit: string;
  samples: number;
  minValue: number;
  maxValue: number;
  averageValue: number;
  firstTimestamp: string;
  lastTimestamp: string;
  latestValue: number;
  firstTimestampUtc: string;
  lastTimestampUtc: string;
}

interface SensorReportEntryRaw
  extends Omit<
    SensorReportEntry,
    "firstTimestamp" | "lastTimestamp" | "firstTimestampUtc" | "lastTimestampUtc"
  > {
  firstTimestamp: Date;
  firstTimestampLocal?: string;
  lastTimestamp: Date;
  lastTimestampLocal?: string;
}

/**
 * Obtiene la última lectura disponible de cada tipo de sensor,
 * agrupada por `deviceId` y `sensorType`.
 *
 * @param deviceId - (Opcional) ID de un dispositivo específico.
 * @returns Promesa con una lista de lecturas más recientes.
 */
export const getLatestSensorReadings = async (
  deviceId?: string
): Promise<LatestSensorReading[]> => {
  const matchStage: Record<string, unknown> = {};

  if (deviceId) {
    matchStage.deviceId = deviceId;
  }

  const pipeline: PipelineStage[] = [];

  if (Object.keys(matchStage).length) {
    pipeline.push({ $match: matchStage });
  }

  pipeline.push({ $sort: { timestamp: -1 } });
  pipeline.push({
    $group: {
      _id: { deviceId: "$deviceId", sensorType: "$sensorType" },
      value: { $first: "$value" },
      unit: { $first: "$unit" },
      timestamp: { $first: "$timestamp" },
      timestampLocal: { $first: "$timestampLocal" },
    },
  });
  pipeline.push({
    $project: {
      _id: 0,
      deviceId: "$_id.deviceId",
      sensorType: "$_id.sensorType",
      value: 1,
      unit: 1,
      timestamp: 1,
      timestampLocal: 1,
    },
  });
  pipeline.push({ $sort: { deviceId: 1, sensorType: 1 } });

  const results = await SensorData.aggregate<LatestSensorReadingRaw>(pipeline);

  return results.map((reading) => {
    const timestampUtc = reading.timestamp.toISOString();
    const timestampLocal =
      reading.timestampLocal ||
      toZonedISOString(reading.timestamp, DEFAULT_TIMEZONE);

    return {
      deviceId: reading.deviceId,
      sensorType: reading.sensorType,
      value: reading.value,
      unit: reading.unit,
      timestamp: timestampLocal,
      timestampUtc,
    };
  });
};

/**
 * Genera un reporte estadístico con valores mínimos, máximos, promedio y cantidad
 * de lecturas por tipo de sensor, filtrable por rango de fechas y dispositivo.
 *
 * @param filters - Filtros de búsqueda personalizados.
 * @returns Promesa con un arreglo de reportes agregados.
 */
export const getSensorReport = async (
  filters: SensorReportFilters
): Promise<SensorReportEntry[]> => {
  const matchStage: Record<string, unknown> = {};

  if (filters.deviceId) {
    matchStage.deviceId = filters.deviceId;
  }

  if (filters.sensorType) {
    matchStage.sensorType = filters.sensorType;
  }

  if (filters.from || filters.to) {
    matchStage.timestamp = {};
    if (filters.from) {
      (matchStage.timestamp as Record<string, Date>).$gte = filters.from;
    }
    if (filters.to) {
      (matchStage.timestamp as Record<string, Date>).$lte = filters.to;
    }
  }

  const pipeline: PipelineStage[] = [];

  if (Object.keys(matchStage).length) {
    pipeline.push({ $match: matchStage });
  }

  pipeline.push({ $sort: { timestamp: 1 } });
  pipeline.push({
    $group: {
      _id: { deviceId: "$deviceId", sensorType: "$sensorType" },
      unit: { $last: "$unit" },
      samples: { $sum: 1 },
      minValue: { $min: "$value" },
      maxValue: { $max: "$value" },
      averageValue: { $avg: "$value" },
      firstTimestamp: { $first: "$timestamp" },
      firstTimestampLocal: { $first: "$timestampLocal" },
      lastTimestamp: { $last: "$timestamp" },
      lastTimestampLocal: { $last: "$timestampLocal" },
      latestValue: { $last: "$value" },
    },
  });
  pipeline.push({
    $project: {
      _id: 0,
      deviceId: "$_id.deviceId",
      sensorType: "$_id.sensorType",
      unit: 1,
      samples: 1,
      minValue: 1,
      maxValue: 1,
      averageValue: 1,
      firstTimestamp: 1,
      firstTimestampLocal: 1,
      lastTimestamp: 1,
      lastTimestampLocal: 1,
      latestValue: 1,
    },
  });
  pipeline.push({ $sort: { deviceId: 1, sensorType: 1 } });

  const results = await SensorData.aggregate<SensorReportEntryRaw>(pipeline);

  return results.map((entry) => {
    const firstTimestampUtc = entry.firstTimestamp.toISOString();
    const lastTimestampUtc = entry.lastTimestamp.toISOString();

    const firstLocal =
      entry.firstTimestampLocal ||
      toZonedISOString(entry.firstTimestamp, DEFAULT_TIMEZONE);
    const lastLocal =
      entry.lastTimestampLocal ||
      toZonedISOString(entry.lastTimestamp, DEFAULT_TIMEZONE);

    return {
      deviceId: entry.deviceId,
      sensorType: entry.sensorType,
      unit: entry.unit,
      samples: entry.samples,
      minValue: entry.minValue,
      maxValue: entry.maxValue,
      averageValue: entry.averageValue,
      latestValue: entry.latestValue,
      firstTimestamp: firstLocal,
      lastTimestamp: lastLocal,
      firstTimestampUtc,
      lastTimestampUtc,
    };
  });
};

const DEFAULT_RAW_DATA_LIMIT = 100;

/**
 * Obtiene los datos crudos de sensores según los filtros de búsqueda aplicados.
 *
 * @param filters - Filtros que pueden incluir `deviceId`, `sensorType`, `from`, `to`, y `limit`.
 * @returns Promesa con una lista de documentos de datos de sensores.
 */
export const getRawSensorData = async (
  filters: SensorReportFilters
): Promise<ISensorDataDocument[]> => {
  const query: Record<string, unknown> = {};

  if (filters.deviceId) {
    query.deviceId = filters.deviceId;
  }

  if (filters.sensorType) {
    query.sensorType = filters.sensorType;
  }

  if (filters.from || filters.to) {
    query.timestamp = {};
    if (filters.from) {
      (query.timestamp as Record<string, Date>).$gte = filters.from;
    }
    if (filters.to) {
      (query.timestamp as Record<string, Date>).$lte = filters.to;
    }
  }

  const limit = filters.limit ?? DEFAULT_RAW_DATA_LIMIT;

  return SensorData.find(query).sort({ timestamp: -1 }).limit(limit);
};
