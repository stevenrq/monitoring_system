import { Server, Socket } from "socket.io";
import SensorData from "../models/sensor-data.model";
import { SensorPayload } from "../interfaces/sensor-payload";
import { checkSensorDataForAlerts } from "../services/notification.service";

/**
 * Inicializa los manejadores de eventos de Socket.IO para diferentes namespaces.
 * Configura la lógica para la conexión de dispositivos y clientes web,
 * así como el manejo de datos de sensores y suscripciones.
 * @param io Instancia del servidor de Socket.IO.
 */
const initializeSocket = (io: Server) => {
  const devicesNamespace = io.of("/devices");
  const webClientsNamespace = io.of("/web-clients");

  devicesNamespace.on("connection", (socket: Socket) => {
    console.log(`Un dispositivo se ha conectado: ${socket.id}`);

    socket.on("registerDevice", (deviceId: string) => {
      console.log(`Dispositivo con ID '${deviceId}' se ha registrado.`);
      socket.join(deviceId); // El dispositivo se une a una sala con su deviceId
    });

    socket.on("sensorData", async (sensorPayload: SensorPayload[]) => {
      try {
        for (const sensorData of sensorPayload) {
          console.log(
            `Datos del sensor recibido: ${JSON.stringify(sensorData)}`,
          );

          if (
            !sensorData.deviceId ||
            !sensorData.sensorType ||
            sensorData.value == undefined ||
            !sensorData.unit
          ) {
            socket.emit("dataError", { message: "Payload inválido" });
            return;
          }

          const newSensorData = new SensorData({
            deviceId: sensorData.deviceId,
            sensorType: sensorData.sensorType,
            value: sensorData.value,
            unit: sensorData.unit,
          });
          await newSensorData.save();
          console.log("Datos del sensorData guardados en la base de datos");

          io.of("/web-clients")
            .to(sensorData.deviceId)
            .emit("newSensorData", sensorData);

          checkSensorDataForAlerts(io, sensorData);
        }
      } catch (error) {
        console.error("Error al procesar los datos del sensor:", error);
        socket.emit("dataError", { message: "Error al procesar los datos" });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Un dispositivo se ha desconectado: ${socket.id}`);
    });
  });

  webClientsNamespace.on("connection", (socket: Socket) => {
    console.log(`Un cliente web se ha conectado: ${socket.id}`);

    socket.on("subscribeToDevice", (deviceId: string) => {
      console.log(
        `El cliente web ${socket.id} se suscribió al dispositivo ${deviceId}`,
      );
      socket.join(deviceId); // El cliente web se une a la sala para recibir actualizaciones del dispositivo
    });

    socket.on("unsubscribeFromDevice", (deviceId: string) => {
      console.log(
        `El cliente web ${socket.id} se ha desuscrito del dispositivo ${deviceId}`,
      );
      socket.leave(deviceId); // El cliente web sale de la sala del dispositivo
    });

    socket.on("disconnect", () => {
      console.log(`Un cliente web se ha desconectado: ${socket.id}`);
    });
  });
};

export default initializeSocket;
