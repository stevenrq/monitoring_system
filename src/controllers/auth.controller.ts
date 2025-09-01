import { Request, Response } from "express";
import * as authService from "../services/auth.service";

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
