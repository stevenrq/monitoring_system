import "./config/index";
import WebSocket from "ws";
import { SensorPayload } from "./interfaces/sensor-payload";

const SIMULATION_INTERVAL_MS = 1000;
const SERVER_URL = `${process.env.BACKEND_URL}`;

if (!process.env.BACKEND_URL) {
  console.error("❌ La variable BACKEND_URL no está definida");
  process.exit(1);
}

const deviceConfig = {
  ESP32_1: {
    sensors: (): Omit<SensorPayload, "deviceId">[] => [
      {
        sensorType: "temperature",
        value: +(Math.random() * 40 + 10).toFixed(2), // Temperatura entre 10 y 50 °C
        unit: "°C",
      },
      {
        sensorType: "humidity",
        value: +(Math.random() * 40 + 60).toFixed(2), // Humedad entre 60 y 100%
        unit: "%",
      },
    ],
  },
  ESP32_2: {
    sensors: (): Omit<SensorPayload, "deviceId">[] => [
      {
        sensorType: "water_level",
        value: +(Math.random() * 100).toFixed(2), // Nivel entre 0 y 100%
        unit: "%",
      },
    ],
  },
};

type DeviceId = keyof typeof deviceConfig;

function createDeviceSimulator(deviceId: DeviceId) {
  const ws = new WebSocket(SERVER_URL.replace(/^http/, "ws"));

  ws.on("open", () => {
    console.log(`[${deviceId}] ✅ Conectado al servidor WebSocket`);
    ws.send(JSON.stringify({ event: "registerDevice", deviceId }));
  });

  ws.on("message", (msg) => {
    console.log(`[${deviceId}] Mensaje recibido:`, msg.toString());
  });

  ws.on("close", () => {
    console.log(`[${deviceId}] 🔌 Desconectado del servidor`);
  });

  ws.on("error", (err) => {
    console.error(`[${deviceId}] ❌ Error de conexión:`, err.message);
  });

  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const readings = deviceConfig[deviceId]
        .sensors()
        .map((s) => ({ ...s, deviceId }));
      ws.send(JSON.stringify(readings));
      console.log(`[${deviceId}] 📤 Enviando datos:`, readings);
    }
  }, SIMULATION_INTERVAL_MS);
}

// Lanzar simuladores
for (const id of Object.keys(deviceConfig) as DeviceId[]) {
  createDeviceSimulator(id);
}
