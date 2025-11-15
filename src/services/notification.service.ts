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

interface SensorThresholdEntry extends SensorThresholdConfig {
  key: string;
  source: "plant" | "manual";
}

const alertThresholds: Record<
  string,
  Record<string, SensorThresholdEntry[]>
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
  const source = association.plantId ? "plant" : "manual";
  const entryKey = association.plantId ?? "manual";

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
    if (sanitized.min !== undefined && sanitized.min <= 0) {
      throw new Error(
        "El umbral mínimo para radiación solar debe ser mayor a 0.",
      );
    }
  }

  if (
    !isClearing &&
    normalizedDeviceId === "ESP32_1" &&
    normalizedSensorType === "soil_humidity"
  ) {
    sanitized.min = 20;
    delete sanitized.max;
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

  const sensorEntries =
    alertThresholds[normalizedDeviceId][normalizedSensorType] ?? [];

  const existingIndex = sensorEntries.findIndex(
    (entry) => entry.key === entryKey && entry.source === source,
  );

  if (sanitized.min === undefined && sanitized.max === undefined) {
    if (existingIndex !== -1) {
      sensorEntries.splice(existingIndex, 1);
      clearAlertState(normalizedDeviceId, normalizedSensorType, entryKey);
    }
    if (sensorEntries.length === 0) {
      delete alertThresholds[normalizedDeviceId][normalizedSensorType];
      if (Object.keys(alertThresholds[normalizedDeviceId]).length === 0) {
        delete alertThresholds[normalizedDeviceId];
      }
    } else {
      alertThresholds[normalizedDeviceId][normalizedSensorType] = sensorEntries;
    }
    return undefined;
  }

  const newEntry: SensorThresholdEntry = {
    thresholds: sanitized,
    plantId: association.plantId ?? null,
    plantName: association.plantName ?? null,
    key: entryKey,
    source,
  };

  if (existingIndex !== -1) {
    sensorEntries[existingIndex] = newEntry;
  } else {
    sensorEntries.push(newEntry);
  }

  alertThresholds[normalizedDeviceId][normalizedSensorType] = sensorEntries;
  clearAlertState(normalizedDeviceId, normalizedSensorType, entryKey);
  return { ...sanitized };
}

/**
 * Obtiene los umbrales configurados para un tipo de sensor.
 */
export function getAlertThreshold(
  deviceId: string,
  sensorType: string,
): SensorThresholdConfig | undefined {
  const entries = alertThresholds[deviceId]?.[sensorType];
  if (!entries || !entries.length) return undefined;
  const manualEntry = entries.find((entry) => entry.source === "manual");
  const selected = manualEntry ?? entries[0];
  return {
    thresholds: selected.thresholds,
    plantId: selected.plantId,
    plantName: selected.plantName,
  };
}

/**
 * Limpia el cooldown de alertas para un dispositivo o sensor específico.
 */
export function clearAlertState(
  deviceId: string,
  sensorType?: string,
  entryKey?: string,
): void {
  const normalizedDeviceId = deviceId?.trim();
  if (!normalizedDeviceId) return;

  if (sensorType) {
    const normalizedSensorType = sensorType.trim();
    if (entryKey) {
      delete lastAlerts[
        `${normalizedDeviceId}-${normalizedSensorType}-${entryKey}`
      ];
      return;
    }
    for (const key of Object.keys(lastAlerts)) {
      if (key.startsWith(`${normalizedDeviceId}-${normalizedSensorType}-`)) {
        delete lastAlerts[key];
      }
    }
    return;
  }

  for (const key of Object.keys(lastAlerts)) {
    if (key.startsWith(`${normalizedDeviceId}-`)) {
      delete lastAlerts[key];
    }
  }
}

export function resetDeviceAlertThresholds(deviceId: string): void {
  const normalizedDeviceId = deviceId?.trim();
  if (!normalizedDeviceId) return;
  clearAlertState(normalizedDeviceId);
  if (alertThresholds[normalizedDeviceId]) {
    delete alertThresholds[normalizedDeviceId];
  }
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

  const entries = getAlertThresholdEntries(deviceId, sensorType);
  if (!entries.length) return;

  const manualEntry = entries.find((entry) => entry.source === "manual");
  const applicableEntries = manualEntry
    ? [manualEntry]
    : entries.filter((entry) => entry.source === "plant");

  if (!applicableEntries.length) {
    return;
  }

  for (const entry of applicableEntries) {
    const thresholds = entry.thresholds;
    const plantId = entry.plantId !== undefined ? entry.plantId : null;
    const plantName = entry.plantName !== undefined ? entry.plantName : null;
    const plantLabel = plantName || plantId || deviceId;
    const sensorLabel = getSensorName(sensorType);
    const unitSuffix = unit ? ` ${unit}` : "";
    let alertMessage: string | null = null;
    let triggeredThresholdType: ThresholdType | null = null;
    let triggeredThresholdValue: number | undefined;

    if (thresholds.max !== undefined && value > thresholds.max) {
      alertMessage = `${plantLabel}: ${sensorLabel} superó el máximo (${value.toFixed(
        1,
      )}${unitSuffix} > ${thresholds.max}${unitSuffix}).`;
      triggeredThresholdType = "max";
      triggeredThresholdValue = thresholds.max;
    } else if (thresholds.min !== undefined && value < thresholds.min) {
      alertMessage = `${plantLabel}: ${sensorLabel} cayó bajo el mínimo (${value.toFixed(
        1,
      )}${unitSuffix} < ${thresholds.min}${unitSuffix}).`;
      triggeredThresholdType = "min";
      triggeredThresholdValue = thresholds.min;
    }

    if (
      !alertMessage ||
      !triggeredThresholdType ||
      triggeredThresholdValue === undefined
    ) {
      continue;
    }

    const alertKey = `${deviceId}-${sensorType}-${entry.key}`;
    const now = Date.now();
    const lastAlertTimestamp = lastAlerts[alertKey];

    // Si la última alerta fue hace menos de el cooldown, no enviar otra
    if (lastAlertTimestamp && now - lastAlertTimestamp < ALERT_COOLDOWN_MS) {
      continue;
    }

    // Registrar la alerta
    lastAlerts[alertKey] = now;

    console.log(`ALERTA: ${alertMessage}`);

    const timestamp = new Date().toISOString();

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

function getAlertThresholdEntries(
  deviceId: string,
  sensorType: string,
): SensorThresholdEntry[] {
  return alertThresholds[deviceId]?.[sensorType] ?? [];
}
