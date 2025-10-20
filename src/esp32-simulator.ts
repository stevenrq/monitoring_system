import "./config/index";
import WebSocket from "ws";
import { SensorPayload } from "./interfaces/sensor-payload";

const SIMULATION_INTERVAL_MS = 1000;
const RAW = process.env.BACKEND_URL!; // p.ej. "https://monitoring-system-opbd.onrender.com"
const SERVER_URL = RAW.replace(/^http/, "ws").replace(/\/?$/, "/"); // -> wss://.../ o ws://.../

if (!process.env.BACKEND_URL) {
  console.error("❌ La variable BACKEND_URL no está definida");
  process.exit(1);
}

const deviceConfig = {
  ESP32_1: {
    sensors: (): Omit<SensorPayload, "deviceId">[] => [
      {
        sensorType: "temperature",
        value: +(Math.random() * 40 + 10).toFixed(2),
        unit: "°C",
      },
      {
        sensorType: "humidity",
        value: +(Math.random() * 40 + 60).toFixed(2),
        unit: "%",
      },
    ],
  },
  ESP32_2: {
    sensors: (): Omit<SensorPayload, "deviceId">[] => [
      {
        sensorType: "water_level",
        value: +(Math.random() * 100).toFixed(2),
        unit: "%",
      },
    ],
  },
};

type DeviceId = keyof typeof deviceConfig;

function createDeviceSimulator(deviceId: DeviceId) {
  let ws = new WebSocket(SERVER_URL);
  let timer: NodeJS.Timeout;

  const startSender = () => {
    timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const readings = deviceConfig[deviceId]
          .sensors()
          .map((s) => ({ ...s, deviceId }));
        ws.send(JSON.stringify(readings));
        console.log(`[${deviceId}] 📤 Enviando datos:`, readings);
      }
    }, SIMULATION_INTERVAL_MS);
  };

  ws.on("open", () => {
    console.log(`[${deviceId}] ✅ Conectado a ${SERVER_URL}`);
    ws.send(JSON.stringify({ event: "registerDevice", deviceId }));
    startSender();
  });

  ws.on("message", (msg) => {
    console.log(`[${deviceId}] ←`, msg.toString());
  });

  ws.on("close", () => {
    console.log(`[${deviceId}] 🔌 Desconectado`);
    clearInterval(timer);
    // Reconexión simple
    setTimeout(() => createDeviceSimulator(deviceId), 3000);
  });

  ws.on("error", (err) => {
    console.error(`[${deviceId}] ❌ Error:`, err.message);
  });
}

for (const id of Object.keys(deviceConfig) as DeviceId[]) {
  createDeviceSimulator(id);
}
