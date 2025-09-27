import { Schema, model, Document } from "mongoose";

export interface IDeviceDocument extends Document {
  deviceId: string;
  name: string;
  location: string;

  /**
   * Referencia a los sensores conectados
   */
  sensors: Schema.Types.ObjectId[];
}

const DeviceSchema = new Schema<IDeviceDocument>({
  deviceId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  sensors: [{ type: Schema.Types.ObjectId, ref: "Sensor" }],
});

export default model<IDeviceDocument>("Device", DeviceSchema);
