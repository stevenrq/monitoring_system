import "./config/index";
import app from "./app";
import * as http from "node:http";
import { initializeWebSocket } from "./socket/socket.handler";

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

initializeWebSocket(server);

server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  console.log(`WebSocket activo en wss://monitoring-system-opbd.onrender.com`);
});
