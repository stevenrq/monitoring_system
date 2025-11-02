import { Model } from "mongoose";

export interface IPlantDocument extends Document {
  name: string;
}

export interface IPlantModel extends Model<IPlantDocument> {}
