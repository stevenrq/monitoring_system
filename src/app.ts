import express from "express";
import connectDB from "./config/database";
import apiRoutes from "./routes/index";
import "./config/index";
import cookieParser from "cookie-parser";
import cors, { CorsOptions } from "cors";

connectDB();

const app = express();

// ADVERTENCIA: Configuración de CORS insegura. Esto es solo para fines de desarrollo/pruebas.
// Para producción, se debe restringir los orígenes a una lista blanca (whitelist) específica.
const corsOptions: CorsOptions = {
  origin: true,
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

app.use("/api", apiRoutes);

export default app;
