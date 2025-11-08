import { Schema, model, Document } from "mongoose";

export interface IFcmToken {
  user: Schema.Types.ObjectId;
  token: string;
  deviceId?: string;
  platform?: string;
  active: boolean;
  lastUsedAt?: Date;
}

export interface IFcmTokenDocument extends IFcmToken, Document {}

const FcmTokenSchema = new Schema<IFcmTokenDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    deviceId: {
      type: String,
      trim: true,
      maxlength: 128,
    },
    platform: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 20,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    timestamps: true,
  }
);

FcmTokenSchema.index({ user: 1 });

const FcmToken = model<IFcmTokenDocument>("FcmToken", FcmTokenSchema);

export default FcmToken;
