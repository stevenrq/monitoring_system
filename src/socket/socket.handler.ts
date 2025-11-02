import { WebSocketServer, WebSocket } from "ws";
import SensorData from "../models/sensor-data.model";
import { SensorPayload } from "../interfaces/sensor-payload";
import { checkSensorDataForAlerts } from "../services/notification.service";
import * as http from "node:http";

export function initializeWebSocket(server: http.Server) {
  const wss = new WebSocketServer({
    server,
    perMessageDeflate: false,
    clientTracking: true,
  });

  const connectedDevices = new Map<string, WebSocket>();
  const webClients = new Set<WebSocket>();

  wss.on("connection", (ws: WebSocket, req) => {
    const path = req.url || "/";
    console.log(`Nueva conexión WS: ${path}`);

    ws.on("message", async (msg) => {
      try {
        const data = JSON.parse(msg.toString());

        if (data.event === "registerDevice") {
          connectedDevices.set(data.deviceId, ws);
          console.log(`Dispositivo registrado: ${data.deviceId}`);
          return;
        }

        if (data.event === "subscribeToDevice") {
          webClients.add(ws);
          console.log(`Cliente suscrito a ${data.deviceId}`);
          return;
        }

        if (Array.isArray(data)) {
          for (const sensorData of data as SensorPayload[]) {
            const { deviceId, sensorType, value, unit } = sensorData;

            if (!deviceId || !sensorType || value === undefined || !unit) {
              ws.send(
                JSON.stringify({
                  event: "dataError",
                  message: "Payload inválido",
                })
              );
              continue;
            }

            const newSensorData = new SensorData(sensorData);
            await newSensorData.save();
            console.log(`Datos guardados de ${deviceId}:`, sensorData);

            const payload = JSON.stringify({
              event: "newSensorData",
              data: sensorData,
            });
            for (const client of webClients) {
              if (client.readyState === WebSocket.OPEN) client.send(payload);
            }

            checkSensorDataForAlerts(wss, sensorData);
          }

          ws.send(
            JSON.stringify({
              event: "ack",
              message: "Datos recibidos correctamente",
            })
          );
        }
      } catch (err) {
        console.error("Error al procesar mensaje:", err);
        ws.send(
          JSON.stringify({
            event: "dataError",
            message: "Error al procesar datos",
          })
        );
      }
    });

    ws.on("close", () => {
      console.log("Conexión cerrada");
      for (const [id, sock] of connectedDevices.entries()) {
        if (sock === ws) connectedDevices.delete(id);
      }
      webClients.delete(ws);
    });
  });

  console.log("WebSocket inicializado correctamente");
  return wss;
}
