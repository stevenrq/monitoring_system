import { Request } from "express";
import jwt from "jsonwebtoken";
import { IUser } from "../interfaces/user.interface";
import User from "../models/user.model";
import { StringValue } from "ms";
import { sendEmail } from "./email.service";
import crypto from "crypto";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;
const ACCESS_TOKEN_EXPIRES_IN = (process.env.ACCESS_TOKEN_EXPIRES_IN ||
  "15m") as StringValue;
const REFRESH_TOKEN_EXPIRES_IN = (process.env.REFRESH_TOKEN_EXPIRES_IN ||
  "30d") as StringValue;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
  console.error(
    "Error fatal: Las variables de entorno para los tokens JWT no están definidas."
  );
  process.exit(1);
}

const generateTokens = async (
  user: IUser
): Promise<{ accessToken: string; refreshToken: string }> => {
  const payload = {
    userId: user._id,
    name: user.name,
    lastName: user.lastName,
    email: user.email,
    username: user.username,
    role: user.role,
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

export const createAdmin = async (req: Request): Promise<IUser> => {
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
  req: Request
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
  oldRefreshToken: string
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

export const forgotPassword = async (email: string): Promise<void> => {
  const user = await User.findOne({ email });
  if (!user) {
    // Para no revelar si un usuario existe o no, no lanzamos un error aquí.
    // La función simplemente retornará y el controlador enviará una respuesta genérica.
    console.log(`Intento de recuperación para email no registrado: ${email}`);
    return;
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetURL = `${FRONTEND_URL}/reset-password/${resetToken}`;

  const message = `
    <h1>Has solicitado un restablecimiento de contraseña</h1>
    <p>Haz clic en el siguiente enlace para restablecer tu contraseña. El enlace es válido por 10 minutos:</p>
    <a href="${resetURL}" target="_blank">Restablecer Contraseña</a>
    <p>Si no solicitaste este cambio, por favor ignora este correo.</p>
  `;

  await sendEmail({
    to: user.email!,
    subject: "Restablecimiento de Contraseña - Sistema de Monitoreo",
    html: message,
  });
};

export const resetPassword = async (
  token: string,
  newPassword: string
): Promise<void> => {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new Error("El token es inválido o ha expirado.");
  }

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
};
