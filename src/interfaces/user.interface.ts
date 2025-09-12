import { Document, Model } from "mongoose";

/**
 * Interfaz que define la estructura de un usuario en la base de datos.
 * Extiende de `Document` de Mongoose para incluir propiedades de documento.
 */
export interface IUser extends Document {
  name?: string;
  lastName?: string;
  phone?: number;
  email?: string;
  username?: string;
  password?: string;
  role?: "user" | "admin";
  refreshToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  /**
   * Compara la contraseña proporcionada con la contraseña almacenada
   * @param candidatePassword  La contraseña proporcionada por el usuario
   * @returns  Verdadero si las contraseñas coinciden, falso en caso contrario
   */
  comparePassword(candidatePassword: string): Promise<boolean>;

  /**
   * Genera un token para restablecer la contraseña
   */
  createPasswordResetToken(): string;
}

export interface IUserModel extends Model<IUser> {}

/**
 * Interfaz que define la estructura de los datos necesarios para crear un administrador.
 */
export type IAdminData = Pick<
  IUser,
  "name" | "lastName" | "phone" | "email" | "username" | "password" | "role"
>;
