import { WebSocket, WebSocketServer } from "ws";
import {
  checkSensorDataForAlerts,
  clearAlertState,
  setAlertThreshold,
} from "../../src/services/notification.service";
import { sendSensorAlertNotification } from "../../src/services/push-notification.service";
import { getActiveFcmTokens } from "../../src/services/fcm-token.service";

jest.mock("../../src/services/push-notification.service", () => ({
  __esModule: true,
  sendSensorAlertNotification: jest.fn().mockResolvedValue("message-id"),
}));

jest.mock("../../src/services/fcm-token.service", () => ({
  __esModule: true,
  getActiveFcmTokens: jest.fn().mockResolvedValue(["token-a", "token-b"]),
}));

const sendSensorAlertNotificationMock =
  sendSensorAlertNotification as jest.MockedFunction<
    typeof sendSensorAlertNotification
  >;
const getActiveFcmTokensMock =
  getActiveFcmTokens as jest.MockedFunction<typeof getActiveFcmTokens>;

type MockClient = {
  socket: WebSocket;
  send: jest.Mock;
};

function createMockClient(state: number): MockClient {
  const send = jest.fn();
  return {
    socket: {
      readyState: state,
      send,
    } as unknown as WebSocket,
    send,
  };
}

function createMockServer() {
  const openClient = createMockClient(WebSocket.OPEN);
  const closedClient = createMockClient(WebSocket.CLOSED);

  const server = {
    clients: new Set<WebSocket>([openClient.socket, closedClient.socket]),
  };

  return {
    wss: server as unknown as WebSocketServer,
    openClient,
    closedClient,
  };
}

describe("notification.service", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("envía el alerta cuando se supera el máximo configurado", async () => {
    const { wss, openClient, closedClient } = createMockServer();
    setAlertThreshold(
      "ESP32_1",
      "temperature",
      { max: 25 },
      { plantId: "plant-1", plantName: "Lavanda" }
    );

    await checkSensorDataForAlerts(wss, {
      deviceId: "ESP32_1",
      sensorType: "temperature",
      value: 26.2,
      unit: "°C",
    });

    expect(openClient.send).toHaveBeenCalledTimes(1);
    expect(closedClient.send).not.toHaveBeenCalled();

    const payload = JSON.parse(openClient.send.mock.calls[0][0]);
    expect(payload.event).toBe("sensorAlert");
    expect(payload.deviceId).toBe("ESP32_1");
    expect(payload.sensorType).toBe("temperature");
    expect(payload.value).toBe(26.2);
    expect(payload.unit).toBe("°C");
    expect(payload.message).toContain("superó el máximo");
    expect(payload.timestamp).toBe("2024-01-01T00:00:00.000Z");
    expect(payload.thresholdType).toBe("max");
    expect(payload.thresholdValue).toBe(25);
    expect(payload.thresholds).toEqual({ max: 25 });
    expect(payload.plantId).toBe("plant-1");
    expect(payload.plantName).toBe("Lavanda");

    expect(sendSensorAlertNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendSensorAlertNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "ESP32_1",
        sensorType: "temperature",
        value: 26.2,
        unit: "°C",
        thresholdType: "max",
        thresholdValue: 25,
        message: expect.stringContaining("superó el máximo"),
        timestamp: "2024-01-01T00:00:00.000Z",
        tokens: ["token-a", "token-b"],
        plantId: "plant-1",
        plantName: "Lavanda",
        sensorThresholds: { max: 25 },
      })
    );
    expect(getActiveFcmTokensMock).toHaveBeenCalledWith({
      deviceId: "ESP32_1",
    });
  });

  it("respeta el cooldown para evitar spam de alertas", async () => {
    const { wss, openClient } = createMockServer();
    setAlertThreshold("ESP32_1", "humidity", { min: 20 });

    const payload = {
      deviceId: "ESP32_1",
      sensorType: "humidity",
      value: 10,
      unit: "%",
    };

    await checkSensorDataForAlerts(wss, payload);
    expect(openClient.send).toHaveBeenCalledTimes(1);
    expect(sendSensorAlertNotificationMock).toHaveBeenCalledTimes(1);

    await checkSensorDataForAlerts(wss, payload);
    expect(openClient.send).toHaveBeenCalledTimes(1);
    expect(sendSensorAlertNotificationMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(300000);
    await checkSensorDataForAlerts(wss, payload);
    expect(openClient.send).toHaveBeenCalledTimes(2);
    expect(sendSensorAlertNotificationMock).toHaveBeenCalledTimes(2);
  });

  it("permite enviar alertas inmediatamente después de limpiar el estado", async () => {
    const { wss, openClient } = createMockServer();
    setAlertThreshold("ESP32_1", "humidity", { min: 20 });

    const payload = {
      deviceId: "ESP32_1",
      sensorType: "humidity",
      value: 10,
      unit: "%",
    };

    await checkSensorDataForAlerts(wss, payload);
    expect(openClient.send).toHaveBeenCalledTimes(1);

    await checkSensorDataForAlerts(wss, payload);
    expect(openClient.send).toHaveBeenCalledTimes(1);

    clearAlertState("ESP32_1");
    await checkSensorDataForAlerts(wss, payload);
    expect(openClient.send).toHaveBeenCalledTimes(2);
  });

  it("envía múltiples alertas cuando existen varias plantas asociadas al mismo sensor", async () => {
    const { wss, openClient } = createMockServer();
    setAlertThreshold(
      "ESP32_1",
      "temperature",
      { max: 26 },
      { plantId: "plant-1", plantName: "Lavanda" }
    );
    setAlertThreshold(
      "ESP32_1",
      "temperature",
      { max: 22 },
      { plantId: "plant-2", plantName: "Rosa" }
    );

    await checkSensorDataForAlerts(wss, {
      deviceId: "ESP32_1",
      sensorType: "temperature",
      value: 27,
      unit: "°C",
    });

    expect(openClient.send).toHaveBeenCalledTimes(2);
    const payloadA = JSON.parse(openClient.send.mock.calls[0][0]);
    const payloadB = JSON.parse(openClient.send.mock.calls[1][0]);

    expect(new Set([payloadA.plantName, payloadB.plantName])).toEqual(
      new Set(["Lavanda", "Rosa"]),
    );
  });

  it("envía alerta cuando el mínimo de radiación solar es mayor a cero", async () => {
    const { wss, openClient } = createMockServer();
    setAlertThreshold(
      "ESP32_1",
      "solar_radiation",
      { min: 50 },
      { plantId: "plant-1", plantName: "Lavanda" },
    );

    await checkSensorDataForAlerts(wss, {
      deviceId: "ESP32_1",
      sensorType: "solar_radiation",
      value: 30,
      unit: "W/m²",
    });

    expect(openClient.send).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(openClient.send.mock.calls[0][0]);
    expect(payload.plantName).toBe("Lavanda");
    expect(payload.thresholdType).toBe("min");
  });

  it("rechaza mínimos de radiación solar iguales o menores a cero", () => {
    expect(() =>
      setAlertThreshold("ESP32_1", "solar_radiation", { min: 0 }),
    ).toThrow("mayor a 0");
    expect(() =>
      setAlertThreshold("ESP32_1", "solar_radiation", { min: -10 }),
    ).toThrow("mayor a 0");
  });
});
