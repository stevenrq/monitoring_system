import { IPlantDocument } from "../interfaces/plant.interface";
import Plant from "../models/plant.model";

export const createPlant = async (
  plantData: Required<IPlantDocument>,
): Promise<IPlantDocument> => {
  const newPlant = new Plant(plantData);
  return await newPlant.save();
};

export const getAllPlants = async (): Promise<IPlantDocument[]> => {
  return Plant.find();
};

export const getPlantById = async (
  plantId: string,
): Promise<IPlantDocument | null> => {
  return Plant.findById(plantId);
};

export const updatePlant = async (
  plantId: string,
  updateData: Partial<IPlantDocument>,
): Promise<IPlantDocument | null> => {
  return Plant.findByIdAndUpdate(plantId, updateData, {
    new: true,
    runValidators: true,
  });
};

export const deletePlant = async (
  plantId: string,
): Promise<IPlantDocument | null> => {
  return Plant.findByIdAndDelete(plantId);
};

export const getPlantCount = async (): Promise<number | null> => {
  return Plant.countDocuments();
};
