import {
  IPlant,
  IPlantDocument,
  PlantUpdatePayload,
} from "../interfaces/plant.interface";
import { SENSOR_TYPES } from "../constants/sensor-types";
import Plant from "../models/plant.model";

export const createPlant = async (
  plantData: IPlant
): Promise<IPlantDocument> => {
  const newPlant = new Plant(plantData);
  return await newPlant.save();
};

export const getAllPlants = async (): Promise<IPlantDocument[]> => {
  return Plant.find();
};

export const getPlantById = async (
  plantId: string
): Promise<IPlantDocument | null> => {
  return Plant.findById(plantId);
};

export const updatePlant = async (
  plantId: string,
  updateData: PlantUpdatePayload
): Promise<IPlantDocument | null> => {
  const plant = await Plant.findById(plantId);
  if (!plant) {
    return null;
  }

  if (updateData.name !== undefined) {
    plant.name = updateData.name;
  }

  if (updateData.thresholds) {
    for (const sensor of SENSOR_TYPES) {
      const sensorUpdate = updateData.thresholds[sensor];
      if (sensorUpdate) {
        plant.thresholds[sensor] = {
          ...plant.thresholds[sensor],
          ...sensorUpdate,
        };
      }
    }
  }

  return plant.save();
};

export const deletePlant = async (
  plantId: string
): Promise<IPlantDocument | null> => {
  return Plant.findByIdAndDelete(plantId);
};

export const getPlantCount = async (): Promise<number | null> => {
  return Plant.countDocuments();
};
