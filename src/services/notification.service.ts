import { WebSocket, WebSocketServer } from "ws";
import { SensorPayload } from "../interfaces/sensor-payload";
import type { SensorThreshold } from "../interfaces/plant.interface";
import { sendSensorAlertNotification, SensorAlertNotification, ThresholdType } from "./push-notification.service";
import { getActiveFcmTokens } from "./fcm-token.service";

/**
 * Últimos tiempos de alerta enviados, para evitar spam (cooldown).
 */
const lastAlerts: Record<string, number> = {};

/**
 * Tiempo mínimo entre alertas del mismo tipo para el mismo dispositivo (en ms).
 */
const ALERT_COOLDOWN_MS = 300000; // 5 minutos

/**
 * Umbrales configurados por el usuario para cada tipo de sensor.
 * Se mantienen en memoria hasta que el proceso se reinicia.
 */
interface SensorThresholdConfig {
  thresholds: SensorThreshold;
  plantId?: string | null;
  plantName?: string | null;
}

const alertThresholds: Record<
  string,
  Record<string, SensorThresholdConfig>
> = {};

export const ALERT_ENABLED_DEVICE_IDS = new Set<string>(["ESP32_1"]);

export interface ThresholdAssociationMetadata {
  plantId?: string | null;
  plantName?: string | null;
}

/**
 * Actualiza los umbrales permitidos para un tipo de sensor.
 */
export function setAlertThreshold(
  deviceId: string,
  sensorType: string,
  thresholds: SensorThreshold,
  association: ThresholdAssociationMetadata = {},
): SensorThreshold | undefined {
  const sanitized: SensorThreshold = {};
  const normalizedDeviceId = deviceId.trim();
  const normalizedSensorType = sensorType.trim();

  const isClearing =
    thresholds.min === undefined && thresholds.max === undefined;

  if (!normalizedDeviceId) {
    throw new Error("El dispositivo es obligatorio para configurar umbrales.");
  }

  if (!normalizedSensorType) {
    throw new Error(
      "El tipo de sensor es obligatorio para configurar umbrales.",
    );
  }

  if (!ALERT_ENABLED_DEVICE_IDS.has(normalizedDeviceId)) {
    return undefined;
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
    !isClearing &&
    normalizedDeviceId === "ESP32_1" &&
    normalizedSensorType === "soil_humidity"
  ) {
    sanitized.min = 20;
    delete sanitized.max;
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
        `El mínimo (${sanitized.min}) no puede ser mayor que el máximo (${sanitized.max}) para ${sensorType}`,
      );
    }
  }

  if (!alertThresholds[normalizedDeviceId]) {
    alertThresholds[normalizedDeviceId] = {};
  }

  alertThresholds[normalizedDeviceId][normalizedSensorType] = {
    thresholds: sanitized,
    plantId: association.plantId ?? null,
    plantName: association.plantName ?? null,
  };
  return { ...sanitized };
}

/**
 * Obtiene los umbrales configurados para un tipo de sensor.
 */
export function getAlertThreshold(
  deviceId: string,
  sensorType: string,
): SensorThresholdConfig | undefined {
  return alertThresholds[deviceId]?.[sensorType];
}

/**
 * Envía alertas a todos los clientes web conectados si los datos superan los umbrales.
 * @param wss Instancia del WebSocketServer (de la librería `ws`).
 * @param sensorData Datos del sensor.
 */
export const checkSensorDataForAlerts = async (
  wss: WebSocketServer,
  sensorData: SensorPayload,
): Promise<void> => {
  const { deviceId, sensorType, value, unit } = sensorData;

  if (!ALERT_ENABLED_DEVICE_IDS.has(deviceId)) {
    return;
  }

  const thresholdConfig = getAlertThreshold(deviceId, sensorType);
  const thresholds = thresholdConfig?.thresholds;
  if (!thresholds) return;

  let alertMessage: string | null = null;
  let triggeredThresholdType: ThresholdType | null = null;
  let triggeredThresholdValue: number | undefined;

  if (thresholds.max !== undefined && value > thresholds.max) {
    alertMessage = `¡Alerta en ${deviceId}! ${getSensorName(sensorType)} ha superado el máximo: ${value.toFixed(
      2,
    )} ${unit} (Máx: ${thresholds.max} ${unit}).`;
    triggeredThresholdType = "max";
    triggeredThresholdValue = thresholds.max;
  } else if (thresholds.min !== undefined && value < thresholds.min) {
    alertMessage = `¡Alerta en ${deviceId}! ${getSensorName(sensorType)} está por debajo del mínimo: ${value.toFixed(
      2,
    )} ${unit} (Mín: ${thresholds.min} ${unit}).`;
    triggeredThresholdType = "min";
    triggeredThresholdValue = thresholds.min;
  }

  if (
    !alertMessage ||
    !triggeredThresholdType ||
    triggeredThresholdValue === undefined
  ) {
    return;
  }

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

  const timestamp = new Date().toISOString();

  const plantId =
    thresholdConfig?.plantId !== undefined ? thresholdConfig.plantId : null;
  const plantName =
    thresholdConfig?.plantName !== undefined ? thresholdConfig.plantName : null;
  const sensorThresholds = { ...thresholds };

  const alertPayload = {
    event: "sensorAlert",
    deviceId,
    sensorType,
    value,
    unit,
    message: alertMessage,
    timestamp,
    thresholdType: triggeredThresholdType,
    thresholdValue: triggeredThresholdValue,
    thresholds: sensorThresholds,
    plantId,
    plantName,
  };

  // Enviar a todos los clientes conectados
  const payloadStr = JSON.stringify(alertPayload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payloadStr);
    }
  }

  let tokens: string[] = [];
  try {
    tokens = await getActiveFcmTokens({ deviceId });
  } catch (error) {
    console.error(
      "No se pudieron cargar los tokens FCM antes de enviar la alerta:",
      error,
    );
  }

  const notificationPayload: SensorAlertNotification = {
    deviceId,
    sensorType,
    value,
    unit,
    thresholdType: triggeredThresholdType,
    thresholdValue: triggeredThresholdValue,
    message: alertMessage,
    timestamp,
    sensorThresholds,
    plantId: plantId ?? undefined,
    plantName: plantName ?? undefined,
  };

  if (tokens.length) {
    notificationPayload.tokens = tokens;
  }

  void sendSensorAlertNotification(notificationPayload).catch((error) => {
    console.error(
      "No se pudo enviar la alerta vía Firebase Cloud Messaging:",
      error,
    );
  });
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
