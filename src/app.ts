import express from "express";
import connectDB from "./config/database";
import apiRoutes from "./routes/index";
import "./config/index";
import cookieParser from "cookie-parser";
import cors, { CorsOptions } from "cors";

connectDB();

const app = express();

const corsOptions: CorsOptions = {
  origin: true, // Permite todas las solicitudes desde cualquier origen
  credentials: true, // Habilita el envío de cookies y encabezados de autorización
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

app.use("/api", apiRoutes);

export default app;
