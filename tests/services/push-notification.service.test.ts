import { BatchResponse, Messaging } from "firebase-admin/messaging";
import { sendSensorAlertNotification } from "../../src/services/push-notification.service";
import { getFirebaseMessaging } from "../../src/config/firebase-admin";

jest.mock("../../src/config/firebase-admin", () => ({
  __esModule: true,
  getFirebaseMessaging: jest.fn(),
}));

const getFirebaseMessagingMock =
  getFirebaseMessaging as jest.MockedFunction<typeof getFirebaseMessaging>;

describe("push-notification.service", () => {
  const sendMock = jest.fn<Promise<string>, any>(() =>
    Promise.resolve("mocked-message-id")
  );
  const sendEachForMulticastMock = jest.fn<
    Promise<BatchResponse>,
    any
  >(() =>
    Promise.resolve({
      successCount: 1,
      failureCount: 0,
      responses: [],
    } as BatchResponse)
  );

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FIREBASE_ALERTS_TOPIC = "";

    getFirebaseMessagingMock.mockReturnValue({
      send: sendMock,
      sendEachForMulticast: sendEachForMulticastMock,
    } as unknown as Messaging);
  });

  afterAll(() => {
    delete process.env.FIREBASE_ALERTS_TOPIC;
  });

  it("envía la notificación al topic por defecto cuando no se proporcionan tokens", async () => {
    await sendSensorAlertNotification({
      deviceId: "ESP32_1",
      sensorType: "temperature",
      value: 32.1,
      unit: "°C",
      thresholdType: "max",
      thresholdValue: 30,
      message: "Temperatura alta",
      timestamp: "2024-01-01T00:00:00.000Z",
    });

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "sensor-alerts",
        notification: expect.objectContaining({
          title: "Alerta en ESP32_1",
          body: "Temperatura alta",
        }),
        data: expect.objectContaining({
          deviceId: "ESP32_1",
          sensorType: "temperature",
          value: "32.1",
          unit: "°C",
          thresholdType: "max",
          thresholdValue: "30",
          timestamp: "2024-01-01T00:00:00.000Z",
        }),
      })
    );
    expect(sendEachForMulticastMock).not.toHaveBeenCalled();
  });

  it("utiliza tokens específicos cuando se proporcionan", async () => {
    const tokens = ["token-1", "token-2"];
    await sendSensorAlertNotification({
      deviceId: "ESP32_1",
      sensorType: "humidity",
      value: 10,
      unit: "%",
      thresholdType: "min",
      thresholdValue: 20,
      message: "Humedad baja",
      timestamp: "2024-01-01T00:00:00.000Z",
      tokens,
      topic: "custom-topic",
      title: "Título personalizado",
    });

    expect(sendEachForMulticastMock).toHaveBeenCalledTimes(1);
    expect(sendEachForMulticastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        notification: expect.objectContaining({
          title: "Título personalizado",
          body: "Humedad baja",
        }),
        data: expect.objectContaining({
          sensorType: "humidity",
          thresholdType: "min",
          thresholdValue: "20",
        }),
        tokens,
      })
    );
    expect(sendMock).not.toHaveBeenCalled();
  });
});
