// app.ts
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

// Si la app está detrás de un proxy (p.ej. Heroku, AWS ELB, Nginx), habilitar trust proxy
app.set("trust proxy", true);

const corsOptions: CorsOptions = {
  origin: true, // Permite todos los orígenes
  credentials: true, // Cookies / Authorization headers
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

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
