/*
 * Script para crear un usuario administrador en la base de datos MongoDB.
 * El uso de este script es solo para fines de desarrollo y pruebas.
 */
import dotenv from "dotenv";
import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

dotenv.config();

interface IUser extends Document {
  name?: string;
  lastName?: string;
  phone?: number;
  email?: string;
  username?: string;
  password?: string;
  role?: "user" | "admin";
}

const userSchema: Schema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    lastName: { type: String, required: true },
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
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
);

const User =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", userSchema);

async function createAdmin(): Promise<void> {
  // NOTA: Se debe asegurar que las propiedades coincidan con el esquema definido en src/models/user.model.ts
  const adminData = {
    name: "Steven",
    lastName: "Ricardo Quiñones",
    phone: 3207108160,
    email: "stevenrq8@gmail.com",
    username: "stevenrq8",
    password: "stevenrq8",
  };

  const { name, lastName, phone, email, username, password } = adminData;

  console.log(`Intentando crear al administrador: '${username}'...`);

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("La variable MONGO_URI no está definida en tu archivo .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Conectado a la base de datos MongoDB.");

    const existingAdmin = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingAdmin) {
      console.log(
        `\nEl usuario administrador con el correo electrónico '${email}' o el nombre de usuario '${username}' ya existe.`
      );
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log("Contraseña hasheada exitosamente.");

    const adminUser = new User({
      name,
      lastName,
      phone,
      email,
      username,
      password: hashedPassword,
      role: "admin",
    });

    await adminUser.save();
    console.log(`\n¡Usuario administrador '${username}' creado exitosamente!`);
  } catch (error: any) {
    console.error("\nError al crear el usuario administrador:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("Desconectado de la base de datos.");
  }
}

createAdmin();
