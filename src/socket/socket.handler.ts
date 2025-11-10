import { WebSocketServer, WebSocket } from "ws";
import SensorData from "../models/sensor-data.model";
import { SensorPayload } from "../interfaces/sensor-payload";
import {
  checkSensorDataForAlerts,
  setAlertThreshold,
} from "../services/notification.service";
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

        if (data.event === "updateThresholds") {
          webClients.add(ws);
          const { sensorType, deviceId } = data;

          if (!deviceId || typeof deviceId !== "string") {
            ws.send(
              JSON.stringify({
                event: "thresholdUpdateError",
                message: "Debes indicar un dispositivo válido.",
              })
            );
            return;
          }

          if (!sensorType || typeof sensorType !== "string") {
            ws.send(
              JSON.stringify({
                event: "thresholdUpdateError",
                message: "Tipo de sensor inválido.",
              })
            );
            return;
          }

          const parsedMin =
            data.min !== undefined && data.min !== ""
              ? Number(data.min)
              : undefined;
          const parsedMax =
            data.max !== undefined && data.max !== ""
              ? Number(data.max)
              : undefined;

          if (
            (parsedMin !== undefined && Number.isNaN(parsedMin)) ||
            (parsedMax !== undefined && Number.isNaN(parsedMax))
          ) {
            ws.send(
              JSON.stringify({
                event: "thresholdUpdateError",
                message: "Los umbrales deben ser números válidos.",
              })
            );
            return;
          }

          try {
            const updated = setAlertThreshold(deviceId, sensorType, {
              min: parsedMin,
              max: parsedMax,
            });

            const payload = JSON.stringify({
              event: "thresholdsUpdated",
              deviceId,
              sensorType,
              thresholds: updated || null,
            });

            for (const client of webClients) {
              if (client.readyState === WebSocket.OPEN) client.send(payload);
            }
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "No se pudo actualizar el umbral.";
            ws.send(
              JSON.stringify({
                event: "thresholdUpdateError",
                message,
              })
            );
          }
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

            await checkSensorDataForAlerts(wss, sensorData);
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
