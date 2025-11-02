import { Document, model, Schema } from "mongoose";
import { DEFAULT_TIMEZONE, toZonedISOString } from "../utils/timezone";

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
  timestampLocal: string;
}

const SensorDataSchema = new Schema<ISensorDataDocument>({
  deviceId: { type: String, required: true, index: true },
  sensorType: { type: String, required: true, index: true },
  value: { type: Number, required: true },
  unit: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  timestampLocal: {
    type: String,
    required: true,
    index: true,
    default: function (this: ISensorDataDocument) {
      const source = this.timestamp || new Date();
      return toZonedISOString(source, DEFAULT_TIMEZONE);
    },
  },
});

// Índice compuesto para optimizar consultas por dispositivo, tipo de sensor y tiempo
SensorDataSchema.index({ deviceId: 1, sensorType: 1, timestamp: -1 });

SensorDataSchema.pre("validate", function (next) {
  if (this.timestamp) {
    this.timestampLocal = toZonedISOString(this.timestamp, DEFAULT_TIMEZONE);
  } else if (this.timestampLocal) {
    this.timestamp = new Date(this.timestampLocal);
  } else {
    const now = new Date();
    this.timestamp = now;
    this.timestampLocal = toZonedISOString(now, DEFAULT_TIMEZONE);
  }
  next();
});

SensorDataSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    if (ret.timestamp instanceof Date || typeof ret.timestamp === "string") {
      const source =
        ret.timestamp instanceof Date
          ? ret.timestamp
          : new Date(ret.timestamp);
      const local =
        typeof ret.timestampLocal === "string"
          ? ret.timestampLocal
          : toZonedISOString(source, DEFAULT_TIMEZONE);

      ret.timestampUtc = source.toISOString();
      ret.timestamp = local;
    }
    return ret;
  },
});

export default model<ISensorDataDocument>("SensorData", SensorDataSchema);
