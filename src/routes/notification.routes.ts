import express from "express";
import { registerFcmTokenController } from "../controllers/notification-token.controller";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/tokens", protect, registerFcmTokenController);

export default router;
