import { WebSocket, WebSocketServer } from "ws";
import {
  checkSensorDataForAlerts,
  setAlertThreshold,
} from "../../src/services/notification.service";
import { sendSensorAlertNotification } from "../../src/services/push-notification.service";

jest.mock("../../src/services/push-notification.service", () => ({
  __esModule: true,
  sendSensorAlertNotification: jest.fn().mockResolvedValue("message-id"),
}));

const sendSensorAlertNotificationMock =
  sendSensorAlertNotification as jest.MockedFunction<
    typeof sendSensorAlertNotification
  >;

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

  it("envía el alerta cuando se supera el máximo configurado", () => {
    const { wss, openClient, closedClient } = createMockServer();
    setAlertThreshold("ESP32_1", "temperature", { max: 25 });

    checkSensorDataForAlerts(wss, {
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
    expect(payload.message).toContain("ha superado el máximo");
    expect(payload.timestamp).toBe("2024-01-01T00:00:00.000Z");

    expect(sendSensorAlertNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendSensorAlertNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "ESP32_1",
        sensorType: "temperature",
        value: 26.2,
        unit: "°C",
        thresholdType: "max",
        thresholdValue: 25,
        message: expect.stringContaining("Máx"),
        timestamp: "2024-01-01T00:00:00.000Z",
      })
    );
  });

  it("respeta el cooldown para evitar spam de alertas", () => {
    const { wss, openClient } = createMockServer();
    setAlertThreshold("ESP32_1", "humidity", { min: 20 });

    const payload = {
      deviceId: "ESP32_1",
      sensorType: "humidity",
      value: 10,
      unit: "%",
    };

    checkSensorDataForAlerts(wss, payload);
    expect(openClient.send).toHaveBeenCalledTimes(1);
    expect(sendSensorAlertNotificationMock).toHaveBeenCalledTimes(1);

    checkSensorDataForAlerts(wss, payload);
    expect(openClient.send).toHaveBeenCalledTimes(1);
    expect(sendSensorAlertNotificationMock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(300000);
    checkSensorDataForAlerts(wss, payload);
    expect(openClient.send).toHaveBeenCalledTimes(2);
    expect(sendSensorAlertNotificationMock).toHaveBeenCalledTimes(2);
  });
});
