import { Request, Response } from "express";
import * as authService from "../services/auth.service";
import { RequestWithUser } from "../middlewares/auth.middleware";

export const createAdmin = async (req: Request, res: Response) => {
  try {
    const user = await authService.createAdmin(req);
    res.status(201).json(user);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error desconocido" });
    }
  }
};

export const handleLogin = async (req: Request, res: Response) => {
  try {
    const { accessToken, refreshToken } = await authService.login(req);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    res.status(200).json({ accessToken });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error desconocido" });
    }
  }
};

export const handleRefreshToken = async (req: Request, res: Response) => {
  const refreshToken: string | undefined = req.cookies.refreshToken;
  if (!refreshToken) {
    return res
      .status(401)
      .json({ error: "No se proporcionó un refresh token" });
  }
  try {
    const newTokens = await authService.refreshToken(refreshToken);
    res.status(200).json({
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(401).json({ error: error.message });
    } else {
      res.status(401).json({ error: "Error desconocido" });
    }
  }
};

export const handleForgotPassword = async (req: Request, res: Response) => {
  try {
    await authService.forgotPassword(req.body.email);
    res.status(200).json({
      message:
        "Si existe una cuenta con ese correo, se ha enviado un enlace para restablecer la contraseña.",
    });
  } catch (error) {
    // El error solo se capturará si falla el envío del correo, no si el usuario no existe.
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error desconocido" });
    }
  }
};

export const handleChangePassword = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    const userId: string = req.user?.userId; // Se obtiene el ID del usuario autenticado
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "Debes enviar ambas contraseñas." });
    }

    await authService.changePassword(userId, oldPassword, newPassword);

    res.status(200).json({ message: "Contraseña actualizada exitosamente." });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error desconocido" });
    }
  }
};
