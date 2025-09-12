/*
 * Script para crear un usuario administrador en la base de datos MongoDB.
 * El uso de este script es solo para fines de desarrollo y pruebas.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { IAdminData } from "./interfaces/user.interface";
import User from "./models/user.model";

dotenv.config();

async function createAdmin(): Promise<void> {
  // NOTA: Se debe asegurar que las propiedades coincidan con el esquema definido en src/models/user.model.ts
  const adminData: IAdminData = {
    name: "Steven",
    lastName: "Ricardo Quiñones",
    phone: 3207108160,
    email: "stevenrq8@gmail.com",
    username: "stevenrq8",
    password: "stevenrq8",
    role: "admin",
  };

  const { name, lastName, phone, email, username, password, role } = adminData;

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
        `\nEl usuario administrador con el correo electrónico '${email}' o el nombre de usuario '${username}' ya existe.`,
      );
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password ?? "", salt);
    console.log("Contraseña hasheada exitosamente.");

    const adminUser = new User({
      name,
      lastName,
      phone,
      email,
      username,
      password: hashedPassword,
      role: role,
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
