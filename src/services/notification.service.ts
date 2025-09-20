import { Server } from "socket.io";
import { SensorPayload } from "../interfaces/sensor-payload";

interface Threshold {
  min?: number;
  max?: number;
}

/**
 * Objeto para almacenar la última vez que se envió una alerta por cada combinación de dispositivo y tipo de sensor.
 * Esto ayuda a evitar el envío excesivo de alertas (cooldown).
 */
const lastAlerts: Record<string, number> = {};

const ALERT_COOLDOWN_MS = 60000;

/**
 * Objeto que contiene los umbrales de alerta para diferentes sensores.
 */
const alertThresholds: Record<string, Threshold> = {
  temperature: { min: 18, max: 28 },
  humidity: { max: 80 },
  air_quality: { max: 400 },
  hydrological_flow: { min: 10 },
};

/**
 * Evalúa los datos de un sensor y emite una alerta si se superan los umbrales.
 * @param io Instancia del servidor de Socket.IO.
 * @param sensorData Datos del sensor a evaluar.
 */
export const checkSensorDataForAlerts = (
  io: Server,
  sensorData: SensorPayload,
) => {
  const { deviceId, sensorType, value, unit } = sensorData;
  const thresholds = alertThresholds[sensorType];

  if (!thresholds) {
    return;
  }

  let alertMessage: string | null = null;

  if (thresholds.max !== undefined && value > thresholds.max) {
    alertMessage = `¡Alerta en ${deviceId}! ${getSensorName(sensorType)} ha superado el umbral máximo: ${value.toFixed(2)} ${unit} (Máximo: ${thresholds.max} ${unit}).`;
  } else if (thresholds.min !== undefined && value < thresholds.min) {
    alertMessage = `¡Alerta en ${deviceId}! ${getSensorName(sensorType)} está por debajo del umbral mínimo: ${value.toFixed(2)} ${unit} (Mínimo: ${thresholds.min} ${unit}).`;
  }

  if (alertMessage) {
    const alertKey = `${deviceId}-${sensorType}`;
    const now = Date.now();
    const lastAlertTimestamp = lastAlerts[alertKey];

    if (!lastAlertTimestamp || now - lastAlertTimestamp > ALERT_COOLDOWN_MS) {
      console.log(`ALERTA GENERADA: ${alertMessage}`);
      const alertPayload = {
        deviceId,
        message: alertMessage,
        timestamp: new Date().toISOString(),
      };

      // Emitir el evento de alerta a los clientes web suscritos a este dispositivo
      io.of("/web-clients").to(deviceId).emit("sensorAlert", alertPayload);

      lastAlerts[alertKey] = now;
    } else {
      console.log(`Alerta para ${alertKey} en enfriamiento. No se enviará.`);
    }
  }
};

function getSensorName(sensorType: string): string {
  const names: { [key: string]: string } = {
    temperature: "La Temperatura",
    humidity: "La Humedad",
    air_quality: "La Calidad del Aire",
    hydrological_flow: "El Caudal Hidrológico",
  };
  return names[sensorType] || sensorType;
}
