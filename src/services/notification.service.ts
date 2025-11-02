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
const ALERT_COOLDOWN_MS = 60000;

/**
 * Umbrales por tipo de sensor.
 */
const alertThresholds: Record<string, Threshold> = {
  temperature: { min: 10, max: 40 },
  humidity: { min: 25, max: 80 },
  water_level: { min: 20, max: 90 },
};

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
  const thresholds = alertThresholds[sensorType];
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
    water_level: "El Nivel de Agua",
  };
  return names[sensorType] || sensorType;
}
