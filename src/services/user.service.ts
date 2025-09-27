import User from "../models/user.model";
import { IUserDocument } from "../interfaces/user.interface";

export const createUser = async (
  userData: Partial<IUserDocument>
): Promise<IUserDocument> => {
  const newUser = new User(userData);
  return await newUser.save();
};

export const getAllUsers = async (): Promise<IUserDocument[]> => {
  return await User.find();
};

export const getUserById = async (
  userId: string
): Promise<IUserDocument | null> => {
  return await User.findById(userId);
};

export const updateUser = async (
  userId: string,
  updateData: Partial<IUserDocument>
): Promise<IUserDocument | null> => {
  return await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  });
};

export const deleteUser = async (
  userId: string
): Promise<IUserDocument | null> => {
  return await User.findByIdAndDelete(userId);
};
