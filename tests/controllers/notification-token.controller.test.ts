import { Response } from "express";
import { registerFcmTokenController } from "../../src/controllers/notification-token.controller";
import { registerFcmToken } from "../../src/services/fcm-token.service";
import { RequestWithUser } from "../../src/middlewares/auth.middleware";

jest.mock("../../src/services/fcm-token.service", () => ({
  __esModule: true,
  registerFcmToken: jest.fn(),
}));

const registerFcmTokenMock =
  registerFcmToken as jest.MockedFunction<typeof registerFcmToken>;

const buildResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
};

describe("notification-token.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("devuelve 201 cuando el token es registrado correctamente", async () => {
    const payload = {
      _id: "token-id",
      user: "user123",
      token: "abc",
      deviceId: "device-1",
      platform: "android",
      active: true,
      lastUsedAt: new Date("2024-01-01T00:00:00.000Z"),
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
      updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    };

    registerFcmTokenMock.mockResolvedValueOnce({
      toObject: () => payload,
    } as any);

    const req = {
      body: { token: "abc", deviceId: "device-1", platform: "android" },
      user: { userId: "user123" },
    } as RequestWithUser;
    const res = buildResponse();

    await registerFcmTokenController(req, res);

    expect(registerFcmTokenMock).toHaveBeenCalledWith({
      token: "abc",
      deviceId: "device-1",
      platform: "android",
      userId: "user123",
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: payload._id,
      user: payload.user,
      token: payload.token,
      deviceId: payload.deviceId,
      platform: payload.platform,
      active: payload.active,
      lastUsedAt: payload.lastUsedAt,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    });
  });

  it("devuelve 401 cuando no hay usuario autenticado", async () => {
    const req = {
      body: { token: "abc" },
    } as RequestWithUser;
    const res = buildResponse();

    await registerFcmTokenController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "No autorizado." });
    expect(registerFcmTokenMock).not.toHaveBeenCalled();
  });

  it("responde 400 cuando el servicio lanza un error", async () => {
    registerFcmTokenMock.mockRejectedValueOnce(new Error("Token inválido"));

    const req = {
      body: { token: "abc" },
      user: { userId: "user123" },
    } as RequestWithUser;
    const res = buildResponse();

    await registerFcmTokenController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Token inválido" });
  });
});
