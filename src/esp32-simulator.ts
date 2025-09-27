import { io, Socket } from "socket.io-client";
import { SensorPayload } from "./interfaces/sensor-payload";

const SERVER_URL = `${process.env.BACKEND_URL}/devices`;
const SIMULATION_INTERVAL_MS = 1000;

// Configuración para cada dispositivo simulado
const deviceConfig = {
  ESP32_1: {
    sensors: (): Omit<SensorPayload, "deviceId">[] => [
      {
        sensorType: "temperature",
        value: Number((Math.random() * 15 + 15).toFixed(2)), // Rango 15-30
        unit: "°C",
      },
      {
        sensorType: "humidity",
        value: Number((Math.random() * 40 + 30).toFixed(2)), // Rango 30-70
        unit: "%",
      },
    ],
  },
  ESP32_2: {
    sensors: (): Omit<SensorPayload, "deviceId">[] => [
      {
        sensorType: "air_quality",
        value: Number((Math.random() * 400 + 50).toFixed(2)), // Rango 50-450
        unit: "ICA",
      },
      {
        sensorType: "hydrological_flow",
        value: Number((Math.random() * 90 + 5).toFixed(2)), // Rango 5-95
        unit: "m3/s",
      },
    ],
  },
};

type DeviceId = keyof typeof deviceConfig;

function createDeviceSimulator(deviceId: DeviceId) {
  const socket = io(SERVER_URL, {
    reconnectionDelayMax: 10000,
  });

  socket.on("connect", () => {
    console.log(
      `[${deviceId}] Conectado al servidor con el ID de socket: ${socket.id}`,
    );
    socket.emit("registerDevice", deviceId);
  });

  const intervalId = setInterval(() => {
    const config = deviceConfig[deviceId];
    if (!config) {
      console.error(`[${deviceId}] No se encontró configuración.`);
      return;
    }

    const sensorData: SensorPayload[] = config
      .sensors()
      .map((sensor) => ({ ...sensor, deviceId }));

    if (socket.connected) {
      socket.emit("sensorData", sensorData);
      console.log(`[${deviceId}] Enviando datos:`, sensorData);
    }
  }, SIMULATION_INTERVAL_MS);

  socket.on("dataError", (error: { message: string }) => {
    console.error(`[${deviceId}] Error del servidor:`, error.message);
  });

  socket.on("disconnect", (reason: Socket.DisconnectReason) => {
    console.log(`[${deviceId}] Desconectado del servidor: ${reason}`);
    if (reason === "io server disconnect") {
      clearInterval(intervalId);
    }
  });
}

// Iniciar simuladores para todos los dispositivos configurados
Object.keys(deviceConfig).forEach((deviceId) => {
  createDeviceSimulator(deviceId as DeviceId);
});
