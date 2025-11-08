import { Response } from "express";
import { RequestWithUser } from "../middlewares/auth.middleware";
import { registerFcmToken } from "../services/fcm-token.service";

export const registerFcmTokenController = async (
  req: RequestWithUser,
  res: Response
) => {
  if (!req.user?.userId) {
    return res.status(401).json({ error: "No autorizado." });
  }

  try {
    const { token, deviceId, platform } = req.body || {};
    const registeredToken = await registerFcmToken({
      token,
      deviceId,
      platform,
      userId: req.user.userId,
    });

    const payload = registeredToken.toObject({
      versionKey: false,
    });

    return res.status(201).json({
      id: payload._id,
      user: payload.user,
      token: payload.token,
      deviceId: payload.deviceId ?? null,
      platform: payload.platform ?? null,
      active: payload.active,
      lastUsedAt: payload.lastUsedAt,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo registrar el token FCM.";
    return res.status(400).json({ error: message });
  }
};
