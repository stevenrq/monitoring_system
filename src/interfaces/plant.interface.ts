import { Model } from "mongoose";

export interface IPlantDocument extends Document {
  name: string;
  description: string;
  quantity: number;
}

export interface IPlantModel extends Model<IPlantDocument> {}
