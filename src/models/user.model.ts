import { Schema, model, Document, Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IUser extends Document {
  name?: string;
  lastName?: string;
  phone?: number;
  email?: string;
  username?: string;
  password?: string;

  /**
   * Rol del usuario (user o admin)
   */
  role?: "user" | "admin";

  /**
   * Compara la contraseña proporcionada con la contraseña almacenada
   * @param candidatePassword  La contraseña proporcionada por el usuario
   * @returns  Verdadero si las contraseñas coinciden, falso en caso contrario
   */
  comparePassword(candidatePassword: string): Promise<boolean>;
  refreshToken?: string;
}

export interface IUserModel extends Model<IUser> {}

const UserSchema = new Schema<IUser, IUserModel>(
  {
    name: { type: String, required: [true, "El nombre es obligatorio"] },
    lastName: { type: String, required: [true, "El apellido es obligatorio"] },
    phone: {
      type: Number,
      required: [true, "El teléfono es obligatorio"],
      unique: true,
      validate: {
        validator: (phone: number) => {
          return /^\d{10}$/.test(phone.toString());
        },
        message: "El teléfono debe tener 10 dígitos",
      },
    },
    email: {
      type: String,
      required: [true, "El email es obligatorio"],
      unique: true,
      match: [/.+@.+\..+/, "Por favor, introduce un email válido"],
    },
    username: {
      type: String,
      required: [true, "El nombre de usuario es obligatorio"],
      unique: true,
    },
    password: {
      type: String,
      required: [true, "La contraseña es obligatoria"],
      select: false,
      validate: {
        validator: (password: string) => {
          return password.length >= 6;
        },
        message: "La contraseña debe tener al menos 6 caracteres",
      },
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    refreshToken: { type: String, select: false },
  },
  { timestamps: true },
);

UserSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    if (error instanceof Error) {
      return next(error);
    }
    next(new Error("Error hashing password"));
  }
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = model<IUser, IUserModel>("User", UserSchema);

export default User;
