import FcmToken from "../../src/models/fcm-token.model";
import { registerFcmToken } from "../../src/services/fcm-token.service";

jest.mock("../../src/models/fcm-token.model", () => ({
  __esModule: true,
  default: {
    findOneAndUpdate: jest.fn(),
  },
}));

const findOneAndUpdateMock = FcmToken.findOneAndUpdate as unknown as jest.Mock;

describe("fcm-token.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registra y actualiza tokens sanitizando los datos", async () => {
    const mockDoc = {
      _id: "token-id",
      token: "abc123",
      user: "user123",
      deviceId: "device-1",
      platform: "android",
      active: true,
      lastUsedAt: new Date(),
    };

    findOneAndUpdateMock.mockResolvedValueOnce(
      mockDoc as unknown as typeof mockDoc
    );

    const result = await registerFcmToken({
      token: "  abc123  ",
      userId: " user123 ",
      deviceId: " device-1 ",
      platform: "ANDROID",
    });

    expect(findOneAndUpdateMock).toHaveBeenCalledWith(
      { token: "abc123" },
      {
        $set: expect.objectContaining({
          user: "user123",
          deviceId: "device-1",
          platform: "android",
          token: "abc123",
          active: true,
        }),
      },
      expect.objectContaining({
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      })
    );

    expect(result).toBe(mockDoc);
  });

  it("establece la plataforma como 'other' cuando no es conocida", async () => {
    const mockDoc = { token: "xyz", user: "user123" };
    findOneAndUpdateMock.mockResolvedValueOnce(
      mockDoc as unknown as typeof mockDoc
    );

    await registerFcmToken({
      token: "xyz",
      userId: "user123",
      platform: "desktop",
    });

    expect(findOneAndUpdateMock).toHaveBeenCalledWith(
      { token: "xyz" },
      {
        $set: expect.objectContaining({
          platform: "other",
        }),
      },
      expect.any(Object)
    );
  });

  it("lanza un error cuando falta el token", async () => {
    await expect(
      registerFcmToken({
        token: "   ",
        userId: "user123",
      })
    ).rejects.toThrow("El token FCM es obligatorio.");
  });
});
