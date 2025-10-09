import express from "express";
import * as auth from "../controllers/auth.controller";
import { authorize, protect } from "../middlewares/auth.middleware";

const router = express.Router();

// Rutas públicas
router.post("/login", auth.handleLogin);
router.post("/refresh", auth.handleRefreshToken);
router.post("/forgot-password", auth.handleForgotPassword);

// Rutas protegidas
router.post("/change-password", protect, auth.handleChangePassword);
router.get("/authenticated-user", protect, auth.getAuthenticatedUser);

// Rutas solo para administradores
router.post("/create-admin", protect, authorize("admin"), auth.createAdmin);

export default router;
