export const SENSOR_TYPES = [
  "temperature",
  "humidity",
  "soil_humidity",
  "solar_radiation",
] as const;

export type SensorType = (typeof SENSOR_TYPES)[number];

export const SENSORS_WITH_OPTIONAL_MIN = new Set<SensorType>([
  "solar_radiation",
]);
