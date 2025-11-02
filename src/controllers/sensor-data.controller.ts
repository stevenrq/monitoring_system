import { Request, Response } from "express";
import {
  getLatestSensorReadings,
  getRawSensorData,
  getSensorReport,
  SensorReportFilters,
} from "../services/sensor-data.service";

/**
 * Parsea un valor a tipo `Date`, validando formato ISO.
 * @throws Error si el formato de fecha no es válido.
 */
const parseDate = (value: unknown): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const date = new Date(String(normalizedValue));

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "El formato de fecha es inválido. Usa un ISO string válido."
    );
  }

  return date;
};

/**
 * Parsea un valor numérico entero positivo usado como límite de registros.
 * @throws Error si el valor no es un número válido.
 */
const parseLimit = (value: unknown): number | undefined => {
  if (!value) {
    return undefined;
  }

  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const limit = Number(normalizedValue);

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error("El parámetro 'limit' debe ser un número entero positivo.");
  }

  return Math.floor(limit);
};

/**
 * Construye un objeto de filtros a partir de los parámetros de la petición.
 */
const normalizeDeviceId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  const normalizedValue = Array.isArray(value) ? value[0] : value;
  const trimmed = String(normalizedValue).trim();
  return trimmed ? trimmed.toUpperCase() : undefined;
};

const buildFilters = (req: Request): SensorReportFilters => {
  const { deviceId, sensorType, from, to, limit } = req.query;

  return {
    deviceId: normalizeDeviceId(deviceId),
    sensorType: sensorType ? String(sensorType) : undefined,
    from: parseDate(from),
    to: parseDate(to),
    limit: parseLimit(limit),
  };
};

/**
 * Controlador para obtener las últimas lecturas por tipo de sensor.
 */
export const latestSensorReadings = async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.query;
    const readings = await getLatestSensorReadings(
      normalizeDeviceId(deviceId)
    );
    res.status(200).json(readings);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Error desconocido" });
    }
  }
};

/**
 * Controlador para generar reportes estadísticos de sensores.
 */
export const sensorReport = async (req: Request, res: Response) => {
  try {
    const filters = buildFilters(req);
    const report = await getSensorReport(filters);
    res.status(200).json(report);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Error desconocido" });
    }
  }
};

/**
 * Controlador para obtener datos crudos de sensores (sin agregaciones).
 */
export const rawSensorData = async (req: Request, res: Response) => {
  try {
    const filters = buildFilters(req);
    const data = await getRawSensorData(filters);
    res.status(200).json(data);
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(400).json({ error: "Error desconocido" });
    }
  }
};
