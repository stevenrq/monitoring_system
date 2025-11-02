import { WebSocketServer, WebSocket } from "ws";
import { SensorPayload } from "../interfaces/sensor-payload";

interface Threshold {
  min?: number;
  max?: number;
}

/**
 * Últimos tiempos de alerta enviados, para evitar spam (cooldown).
 */
const lastAlerts: Record<string, number> = {};

/**
 * Tiempo mínimo entre alertas del mismo tipo para el mismo dispositivo (en ms).
 */
const ALERT_COOLDOWN_MS = 10000; // 10 segundos

/**
 * Umbrales configurados por el usuario para cada tipo de sensor.
 * Se mantienen en memoria hasta que el proceso se reinicia.
 */
const alertThresholds: Record<string, Record<string, Threshold>> = {};

/**
 * Actualiza los umbrales permitidos para un tipo de sensor.
 */
export function setAlertThreshold(
  deviceId: string,
  sensorType: string,
  thresholds: Threshold
): Threshold | undefined {
  const sanitized: Threshold = {};
  const normalizedDeviceId = deviceId.trim();
  const normalizedSensorType = sensorType.trim();

  if (!normalizedDeviceId) {
    throw new Error("El dispositivo es obligatorio para configurar umbrales.");
  }

  if (!normalizedSensorType) {
    throw new Error(
      "El tipo de sensor es obligatorio para configurar umbrales."
    );
  }

  if (thresholds.min !== undefined && !Number.isNaN(thresholds.min)) {
    sanitized.min = thresholds.min;
  }

  if (thresholds.max !== undefined && !Number.isNaN(thresholds.max)) {
    sanitized.max = thresholds.max;
  }

  if (normalizedSensorType === "solar_radiation") {
    delete sanitized.min;
  }

  if (
    sanitized.min === undefined &&
    sanitized.max === undefined &&
    alertThresholds[normalizedDeviceId]?.[normalizedSensorType]
  ) {
    delete alertThresholds[normalizedDeviceId][normalizedSensorType];
    if (Object.keys(alertThresholds[normalizedDeviceId]).length === 0) {
      delete alertThresholds[normalizedDeviceId];
    }
    return undefined;
  }

  if (sanitized.min !== undefined && sanitized.max !== undefined) {
    if (sanitized.min > sanitized.max) {
      throw new Error(
        `El mínimo (${sanitized.min}) no puede ser mayor que el máximo (${sanitized.max}) para ${sensorType}`
      );
    }
  }

  if (!alertThresholds[normalizedDeviceId]) {
    alertThresholds[normalizedDeviceId] = {};
  }

  alertThresholds[normalizedDeviceId][normalizedSensorType] = sanitized;
  return alertThresholds[normalizedDeviceId][normalizedSensorType];
}

/**
 * Obtiene los umbrales configurados para un tipo de sensor.
 */
export function getAlertThreshold(
  deviceId: string,
  sensorType: string
): Threshold | undefined {
  return alertThresholds[deviceId]?.[sensorType];
}

/**
 * Envía alertas a todos los clientes web conectados si los datos superan los umbrales.
 * @param wss Instancia del WebSocketServer (de la librería `ws`).
 * @param sensorData Datos del sensor.
 */
export const checkSensorDataForAlerts = (
  wss: WebSocketServer,
  sensorData: SensorPayload
) => {
  const { deviceId, sensorType, value, unit } = sensorData;
  const thresholds = getAlertThreshold(deviceId, sensorType);
  if (!thresholds) return;

  let alertMessage: string | null = null;

  if (thresholds.max !== undefined && value > thresholds.max) {
    alertMessage = `¡Alerta en ${deviceId}! ${getSensorName(sensorType)} ha superado el máximo: ${value.toFixed(
      2
    )} ${unit} (Máx: ${thresholds.max} ${unit}).`;
  } else if (thresholds.min !== undefined && value < thresholds.min) {
    alertMessage = `¡Alerta en ${deviceId}! ${getSensorName(sensorType)} está por debajo del mínimo: ${value.toFixed(
      2
    )} ${unit} (Mín: ${thresholds.min} ${unit}).`;
  }

  if (!alertMessage) return;

  const alertKey = `${deviceId}-${sensorType}`;
  const now = Date.now();
  const lastAlertTimestamp = lastAlerts[alertKey];

  // Si la última alerta fue hace menos de el cooldown, no enviar otra
  if (lastAlertTimestamp && now - lastAlertTimestamp < ALERT_COOLDOWN_MS) {
    return;
  }

  // Registrar la alerta
  lastAlerts[alertKey] = now;

  console.log(`ALERTA: ${alertMessage}`);

  const alertPayload = {
    event: "sensorAlert",
    deviceId,
    message: alertMessage,
    timestamp: new Date().toISOString(),
  };

  // Enviar a todos los clientes conectados
  const payloadStr = JSON.stringify(alertPayload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payloadStr);
    }
  }
};

/**
 * Obtiene el nombre legible de un tipo de sensor.
 * @param sensorType Tipo de sensor.
 * @returns Nombre legible del sensor.
 */
function getSensorName(sensorType: string): string {
  const names: { [key: string]: string } = {
    temperature: "La Temperatura",
    humidity: "La Humedad",
    soil_humidity: "La Humedad del Suelo",
    solar_radiation: "La Radiación Solar",
  };
  return names[sensorType] || sensorType;
}
