import "./config/index";
import app from "./app";
import * as http from "node:http";
import { Server as SocketIOServer } from "socket.io";
import initializeSocket from "./socket/socket.handler";

const PORT = process.env.PORT || 3000;

const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*", // Permite todas las conexiones
    methods: ["GET", "POST"],
  },
});

initializeSocket(io);

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  console.log("Servidor de WebSockets escuchando...");
});
