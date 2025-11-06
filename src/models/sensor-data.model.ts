import { Document, model, Schema } from "mongoose";

export interface ISensorDataDocument extends Document {
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

const SensorDataSchema = new Schema<ISensorDataDocument>({
  deviceId: { type: String, required: true, index: true },
  sensorType: { type: String, required: true, index: true },
  value: { type: Number, required: true },
  unit: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
});

// Índice compuesto para optimizar consultas por dispositivo, tipo de sensor y tiempo
SensorDataSchema.index({ deviceId: 1, sensorType: 1, timestamp: -1 });

SensorDataSchema.pre("validate", function (next) {
  const doc = this as ISensorDataDocument & {
    timestamp?: Date | string;
  };

  if (doc.timestamp && !(doc.timestamp instanceof Date)) {
    const parsed = new Date(doc.timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      doc.timestamp = parsed;
    }
  }
  next();
});

SensorDataSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    if (ret.timestamp instanceof Date) {
      ret.timestamp = ret.timestamp.toISOString();
    } else if (typeof ret.timestamp === "string") {
      const parsed = new Date(ret.timestamp);
      if (!Number.isNaN(parsed.getTime())) {
        ret.timestamp = parsed.toISOString();
      }
    }
    return ret;
  },
});

export default model<ISensorDataDocument>("SensorData", SensorDataSchema);
