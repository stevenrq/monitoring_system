import { Document, Model } from "mongoose";

export interface IUserDocument extends Document {
  name?: string;
  lastName?: string;
  phone?: number;
  email?: string;
  username?: string;
  password?: string;
  role?: "user" | "admin";
  refreshToken?: string;

  /**
   * Compara la contraseña proporcionada con la contraseña almacenada
   * @param candidatePassword  La contraseña proporcionada por el usuario
   * @returns  Verdadero si las contraseñas coinciden, falso en caso contrario
   */
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUserDocument> {}

/**
 * Interfaz que define la estructura de los datos necesarios para crear un administrador.
 */
export type IAdminData = Pick<
  IUserDocument,
  "name" | "lastName" | "phone" | "email" | "username" | "password" | "role"
>;
