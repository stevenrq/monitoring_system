import express from "express";
import connectDB from "./config/database";
import apiRoutes from "./routes/index";
import "./config/index";
import cookieParser from "cookie-parser";

connectDB();

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use("/api", apiRoutes);

export default app;
