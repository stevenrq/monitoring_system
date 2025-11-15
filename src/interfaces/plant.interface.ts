import { Document, Model } from "mongoose";
import { SensorType } from "../constants/sensor-types";

export interface SensorThreshold {
  min?: number;
  max?: number;
}

export type PlantThresholds = Record<SensorType, SensorThreshold>;

export interface IPlant {
  name: string;
  thresholds: PlantThresholds;
  deviceId?: string;
}

export type PlantThresholdsUpdate = Partial<
  Record<SensorType, Partial<SensorThreshold>>
>;

export interface PlantUpdatePayload {
  name?: string;
  thresholds?: PlantThresholdsUpdate;
  deviceId?: string;
}

export interface IPlantDocument extends IPlant, Document {}

export interface IPlantModel extends Model<IPlantDocument> {}
