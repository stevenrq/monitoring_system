import User from "../models/user.model";
import { IUser } from "../interfaces/user.interface";

export const createUser = async (userData: Partial<IUser>): Promise<IUser> => {
  const newUser = new User(userData);
  return await newUser.save();
};

export const getAllUsers = async (): Promise<IUser[]> => {
  return await User.find();
};

export const getUserById = async (userId: string): Promise<IUser | null> => {
  return await User.findById(userId);
};

export const updateUser = async (
  userId: string,
  updateData: Partial<IUser>
): Promise<IUser | null> => {
  return await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  });
};

export const deleteUser = async (userId: string): Promise<IUser | null> => {
  return await User.findByIdAndDelete(userId);
};
