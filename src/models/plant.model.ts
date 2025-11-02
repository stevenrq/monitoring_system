import { model, Schema } from "mongoose";
import { IPlantDocument, IPlantModel } from "../interfaces/plant.interface";

export const PlantSchema = new Schema<IPlantDocument, IPlantModel>(
  {
    name: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

const Plant = model<IPlantDocument, IPlantModel>("Plant", PlantSchema);

export default Plant;
