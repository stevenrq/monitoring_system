import { IPlantDocument } from "../interfaces/plant.interface";
import Plant from "../models/plant.model";

export const createPlant = async (
  plantData: Required<IPlantDocument>
): Promise<IPlantDocument> => {
  const newPlant = new Plant(plantData);
  return await newPlant.save();
};

export const getAllPlants = async (): Promise<IPlantDocument[]> => {
  return await Plant.find();
};

export const getPlantById = async (
  plantId: string
): Promise<IPlantDocument | null> => {
  return await Plant.findById(plantId);
};

export const updatePlant = async (
  plantId: string,
  updateData: Partial<IPlantDocument>
): Promise<IPlantDocument | null> => {
  return await Plant.findByIdAndUpdate(plantId, updateData, {
    new: true,
    runValidators: true,
  });
};

export const deletPlant = async (
  plantId: string
): Promise<IPlantDocument | null> => {
  return await Plant.findByIdAndDelete(plantId);
};
