import { Document, model, Schema } from "mongoose";

export interface IHourlyAverage {
  deviceId: string;
  sensorType: string;
  hour: Date;
  avg: number;
  min: number;
  max: number;
  samples: number;
  units: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHourlyAverageDocument extends IHourlyAverage, Document {}

const HourlyAverageSchema = new Schema<IHourlyAverageDocument>(
  {
    deviceId: { type: String, required: true, index: true },
    sensorType: { type: String, required: true, index: true },
    hour: { type: Date, required: true, index: true },
    avg: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    samples: { type: Number, required: true },
    units: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: "sensor_hourly_averages",
  }
);

HourlyAverageSchema.index(
  { deviceId: 1, sensorType: 1, hour: 1 },
  { name: "hourly_device_sensor_hour_unique", unique: true }
);

HourlyAverageSchema.pre("save", function (next) {
  if (this.hour) {
    const truncated = new Date(this.hour);
    truncated.setMinutes(0, 0, 0);
    this.hour = truncated;
  }
  next();
});

const HourlyAverageModel = model<IHourlyAverageDocument>(
  "SensorHourlyAverage",
  HourlyAverageSchema
);

export default HourlyAverageModel;
