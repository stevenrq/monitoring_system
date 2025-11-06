import "./config/index";
import app from "./app";
import * as http from "node:http";
import { initializeWebSocket } from "./socket/socket.handler";
import { initializePlantThresholds } from "./services/plant.service";
import { startHourlyAggregationJob } from "./jobs/hourly-aggregator.job";

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

initializeWebSocket(server);

initializePlantThresholds()
  .then(() => {
    console.log("Umbrales de plantas aplicados correctamente.");
  })
  .catch((error) => {
    console.error(
      "No se pudieron aplicar los umbrales de las plantas al iniciar el servidor:",
      error
    );
  });

server.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  console.log(`WebSocket activo en ws://98.86.100.220:3000`);
  startHourlyAggregationJob();
});
