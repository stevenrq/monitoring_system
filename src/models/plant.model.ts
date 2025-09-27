import { model, Schema } from "mongoose";
import { IPlantDocument, IPlantModel } from "../interfaces/plant.interface";

export const PlantSchema = new Schema<IPlantDocument, IPlantModel>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

const Plant = model<IPlantDocument, IPlantModel>("Plant", PlantSchema);

export default Plant;
