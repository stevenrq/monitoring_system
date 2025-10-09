import { Request } from "express";
import jwt from "jsonwebtoken";
import { IUserDocument } from "../interfaces/user.interface";
import User from "../models/user.model";
import { StringValue } from "ms";
import { sendEmail } from "./email.service";
import crypto from "node:crypto";
import { JwtCustomPayload } from "../interfaces/jwt-custom-payload";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;
const ACCESS_TOKEN_EXPIRES_IN = (process.env.ACCESS_TOKEN_EXPIRES_IN ||
  "15m") as StringValue;
const REFRESH_TOKEN_EXPIRES_IN = (process.env.REFRESH_TOKEN_EXPIRES_IN ||
  "30d") as StringValue;

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  console.error(
    "Error fatal: Las variables de entorno para los tokens JWT no están definidas.",
  );
  process.exit(1);
}

const generateTokens = async (
  user: IUserDocument,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const payload: JwtCustomPayload = {
    userId: user._id as string,
    name: user.name as string,
    lastName: user.lastName as string,
    email: user.email as string,
    username: user.username as string,
    role: user.role as string,
  };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

  const refreshToken = jwt.sign({ userId: user._id }, REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

export const createAdmin = async (req: Request): Promise<IUserDocument> => {
  const { name, lastName, phone, email, username, password } = req.body;

  try {
    const user = new User({
      name,
      lastName,
      phone,
      email,
      username,
      password,
      role: "admin",
    });

    await user.save();
    return user;
  } catch (error: any) {
    if (error.code === 11000) {
      throw new Error("El nombre de usuario o el email ya existen.");
    }
    console.error("Error en el registro:", error);
    throw new Error("No se pudo registrar al administrador.");
  }
};

export const login = async (
  req: Request,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username }).select("+password");

    if (!user) {
      throw new Error("Credenciales inválidas");
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error("Credenciales inválidas");
    }

    return generateTokens(user);
  } catch (error) {
    console.error("Error en el login:", error);
    throw error;
  }
};

export const refreshToken = async (
  oldRefreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  try {
    const decoded = jwt.verify(oldRefreshToken, REFRESH_TOKEN_SECRET) as {
      userId: string;
    };

    const user = await User.findById(decoded.userId).select("+refreshToken");

    if (!user || user.refreshToken !== oldRefreshToken) {
      throw new Error("Refresh token inválido o revocado");
    }

    return generateTokens(user);
  } catch (error) {
    console.error("Error al refrescar el token:", error);
    throw new Error("Refresh token inválido o expirado");
  }
};

const generateRandomPassword = (length = 12): string => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const all = upper + lower + digits;

  let password = "";
  password += upper[crypto.randomInt(0, upper.length)];
  password += lower[crypto.randomInt(0, lower.length)];
  password += digits[crypto.randomInt(0, digits.length)];

  for (let i = 3; i < length; i++) {
    password += all[crypto.randomInt(0, all.length)];
  }

  return password
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
};

export const forgotPassword = async (email: string): Promise<void> => {
  const user = await User.findOne({ email });
  if (!user) {
    console.log(`Intento de recuperación para email no registrado: ${email}`);
    return;
  }

  const temporaryPassword = generateRandomPassword(12);
  user.password = temporaryPassword;
  user.refreshToken = undefined;
  await user.save({ validateBeforeSave: false });

  const message = `
    <h1>Recuperación de contraseña</h1>
    <p>Se ha generado una contraseña temporal para tu cuenta. Por favor inicia sesión con esta contraseña y cámbiala inmediatamente.</p>
    <p><strong>Contraseña temporal:</strong> ${temporaryPassword}</p>
    <p>Este cambio fue solicitado por ti (o por alguien con acceso a tu correo). Si no fuiste tú, contacta al administrador.</p>
  `;

  await sendEmail({
    to: user.email!,
    from: process.env.EMAIL_USER!,
    subject: "Nueva contraseña temporal - Sistema de Monitoreo Ambiental",
    text: `Se ha generado una contraseña temporal para tu cuenta: ${temporaryPassword}. Por favor, inicia sesión y cámbiala.`,
    html: message,
  });
};

export const changePassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  const user = await User.findById(userId).select("+password +refreshToken");
  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const isMatch = await user.comparePassword(oldPassword);
  if (!isMatch) {
    throw new Error("La contraseña actual es incorrecta");
  }

  user.password = newPassword;
  user.refreshToken = undefined;

  await user.save({ validateBeforeSave: false });
};
