import FcmToken, { IFcmTokenDocument } from "../models/fcm-token.model";

export interface RegisterFcmTokenPayload {
  token: string;
  userId: string;
  deviceId?: string;
  platform?: string;
}

const KNOWN_PLATFORMS = new Set(["android", "ios", "web"]);

const sanitizePlatform = (platform?: string): string | undefined => {
  if (!platform) return undefined;
  const normalized = platform.trim().toLowerCase();
  if (!normalized) return undefined;
  return KNOWN_PLATFORMS.has(normalized) ? normalized : "other";
};

const sanitizeDeviceId = (deviceId?: string): string | undefined => {
  if (!deviceId) return undefined;
  const normalized = deviceId.trim();
  return normalized || undefined;
};

export const registerFcmToken = async (
  payload: RegisterFcmTokenPayload
): Promise<IFcmTokenDocument> => {
  const sanitizedToken = payload.token?.trim();
  if (!sanitizedToken) {
    throw new Error("El token FCM es obligatorio.");
  }

  const sanitizedUserId = payload.userId?.trim();
  if (!sanitizedUserId) {
    throw new Error("El identificador del usuario es obligatorio.");
  }

  const update = {
    user: sanitizedUserId,
    deviceId: sanitizeDeviceId(payload.deviceId),
    platform: sanitizePlatform(payload.platform),
    active: true,
    lastUsedAt: new Date(),
    token: sanitizedToken,
  };

  const tokenDoc = await FcmToken.findOneAndUpdate(
    { token: sanitizedToken },
    { $set: update },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  if (!tokenDoc) {
    throw new Error("No fue posible registrar el token FCM.");
  }

  return tokenDoc;
};
