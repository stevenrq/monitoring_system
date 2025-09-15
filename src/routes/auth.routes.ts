import express from "express";
import * as auth from "../controllers/auth.controller";
import { protect, authorize } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/create-admin", protect, authorize("admin"), auth.createAdmin);
router.post("/login", auth.handleLogin);
router.post("/refresh", auth.handleRefreshToken);
router.post("/forgot-password", auth.handleForgotPassword);
router.post("/reset-password/:token", auth.handleResetPassword);

export default router;
