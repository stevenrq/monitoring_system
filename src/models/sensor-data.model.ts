import { Document, model, Schema } from "mongoose";

export interface ISensorData extends Document {
  /**
   * ID del dispositivo al que pertenece el sensor
   */
  deviceId: string;

  /**
   * Tipo de sensor (ej. "temperatura", "humedad")
   */
  sensorType: string;
  value: number;

  /**
   * Unidad de medida del valor del sensor (ej. "°C", "%")
   */
  unit: string;
  timestamp: Date;
}

const SensorDataSchema = new Schema<ISensorData>({
  deviceId: { type: String, required: true, index: true },
  sensorType: { type: String, required: true, index: true },
  value: { type: Number, required: true },
  unit: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
});

// Índice compuesto para optimizar consultas por dispositivo, tipo de sensor y tiempo
SensorDataSchema.index({ deviceId: 1, sensorType: 1, timestamp: -1 });

export default model<ISensorData>("SensorData", SensorDataSchema);
