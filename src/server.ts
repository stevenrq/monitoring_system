import "./config/index";
import app from "./app";
import * as http from "node:http";
import os from "node:os";
import { initializeWebSocket } from "./socket/socket.handler";

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

initializeWebSocket(server);

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const localIP = getLocalIP();

server.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
  console.log(`🌐 WebSocket activo en ws://${localIP}:${PORT}`);
});
