import { BatchResponse } from "firebase-admin/messaging";
import type { SensorThreshold } from "../interfaces/plant.interface";
import { getFirebaseMessaging } from "../config/firebase-admin";

const DEFAULT_ALERT_TOPIC =
  process.env.FIREBASE_ALERTS_TOPIC?.trim() || "sensor-alerts";

export type ThresholdType = "min" | "max";

export interface SensorAlertNotification {
  deviceId: string;
  sensorType: string;
  value: number;
  unit: string;
  thresholdType: ThresholdType;
  thresholdValue: number;
  message: string;
  timestamp: string;
  tokens?: string[];
  topic?: string;
  title?: string;
  plantId?: string | null;
  plantName?: string | null;
  sensorThresholds?: SensorThreshold;
}

export async function sendSensorAlertNotification(
  payload: SensorAlertNotification
): Promise<string | BatchResponse> {
  const messaging = getFirebaseMessaging();

  const notification = {
    title: payload.title || `Alerta en ${payload.deviceId}`,
    body: payload.message,
  };

  const data: Record<string, string> = {
    deviceId: payload.deviceId,
    sensorType: payload.sensorType,
    message: payload.message,
    value: payload.value.toString(),
    unit: payload.unit,
    thresholdType: payload.thresholdType,
    thresholdValue: payload.thresholdValue?.toString() ?? "",
    timestamp: payload.timestamp,
  };

  if (payload.plantId !== undefined && payload.plantId !== null) {
    data.plantId = payload.plantId;
  }

  if (payload.plantName !== undefined && payload.plantName !== null) {
    data.plantName = payload.plantName;
  }

  if (payload.sensorThresholds?.min !== undefined) {
    data.sensorThresholdMin = payload.sensorThresholds.min.toString();
  }

  if (payload.sensorThresholds?.max !== undefined) {
    data.sensorThresholdMax = payload.sensorThresholds.max.toString();
  }

  if (payload.tokens?.length) {
    return messaging.sendEachForMulticast({
      notification,
      data,
      tokens: payload.tokens,
    });
  }

  const topic = payload.topic || DEFAULT_ALERT_TOPIC;
  return messaging.send({
    notification,
    data,
    topic,
  });
}
