import path from "node:path";
import express from "express";
import connectDB from "./config/database";
import apiRoutes from "./routes/index";
import "./config/index";
import cookieParser from "cookie-parser";
import cors, { CorsOptions } from "cors";
import swaggerUi from "swagger-ui-express";

connectDB();

const app = express();

const corsOptions: CorsOptions = {
  origin: true, // Permite todas las solicitudes desde cualquier origen
  credentials: true, // Habilita el envío de cookies y encabezados de autorización
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

const openApiDir = path.resolve(__dirname, "..");

app.get("/api/docs/openapi.json", (_req, res) => {
  res.sendFile(path.join(openApiDir, "openapi.json"));
});

app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(undefined, {
    explorer: true,
    swaggerOptions: { url: "/api/docs/openapi.json" },
  })
);

app.use("/api", apiRoutes);

export default app;
