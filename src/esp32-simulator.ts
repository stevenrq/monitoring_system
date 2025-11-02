import "./config/index";
import WebSocket from "ws";
import { SensorPayload } from "./interfaces/sensor-payload";

const SIMULATION_INTERVAL_MS = 5000; // 5 segundos
const RAW = process.env.BACKEND_URL!; // p.ej. "http://34.227.8.130:3000"
const SERVER_URL = RAW.replace(/^http/, "ws").replace(/\/?$/, "/"); // -> wss://.../ o ws://.../

if (!process.env.BACKEND_URL) {
  console.error("La variable BACKEND_URL no está definida");
  process.exit(1);
}

// Función para simular un sensor DHT11 (temperatura + humedad)
function simulateDHT11(): Omit<SensorPayload, "deviceId">[] {
  return [
    {
      sensorType: "temperature",
      value: +(Math.random() * 40 + 10).toFixed(2), // entre 10°C y 50°C
      unit: "°C",
    },
    {
      sensorType: "humidity",
      value: +(Math.random() * 40 + 60).toFixed(2), // entre 60% y 100%
      unit: "%",
    },
  ];
}

// Configuración de dispositivos y sensores
const deviceConfig = {
  // Interior del Umbráculo
  ESP32_1: {
    sensors: (): Omit<SensorPayload, "deviceId">[] => [
      ...simulateDHT11(),
      ...simulateDHT11(),
      ...simulateDHT11(),

      {
        sensorType: "solar_radiation",
        value: +(Math.random() * 1200).toFixed(2), // W/m2 típico de 0 a 1200
        unit: "W/m2",
      },
      {
        sensorType: "soil_humidity",
        value: +(Math.random() * 100).toFixed(2), // entre 0% y 100%
        unit: "%",
      },
    ],
  },
  // Exterior del Umbráculo
  ESP32_2: {
    sensors: (): Omit<SensorPayload, "deviceId">[] => [
      ...simulateDHT11(),
      ...simulateDHT11(),
      ...simulateDHT11(),

      {
        sensorType: "solar_radiation",
        value: +(Math.random() * 1200).toFixed(2),
        unit: "W/m2",
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
        console.log(`[${deviceId}] Enviando datos:`, readings);
      }
    }, SIMULATION_INTERVAL_MS);
  };

  ws.on("open", () => {
    console.log(`[${deviceId}] Conectado a ${SERVER_URL}`);
    ws.send(JSON.stringify({ event: "registerDevice", deviceId }));
    startSender();
  });

  ws.on("message", (msg) => {
    console.log(`[${deviceId}] ←`, msg.toString());
  });

  ws.on("close", () => {
    console.log(`[${deviceId}] Desconectado`);
    clearInterval(timer);
    setTimeout(() => createDeviceSimulator(deviceId), 3000);
  });

  ws.on("error", (err) => {
    console.error(`[${deviceId}] Error:`, err.message);
  });
}

// Iniciar simulación por cada ESP32 registrada
for (const id of Object.keys(deviceConfig) as DeviceId[]) {
  createDeviceSimulator(id);
}
