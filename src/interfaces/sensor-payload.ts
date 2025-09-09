/**
 * Interfaz que define la estructura de un payload de datos de un sensor.
 */
export interface SensorPayload {
  deviceId: string;
  sensorType: string;
  value: number;
  unit: string;
}
