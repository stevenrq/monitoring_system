import express from "express";
import * as auth from "../controllers/auth.controller";
import { protect, authorize } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/create-admin", protect, authorize("admin"), auth.createAdmin);
router.post("/login", auth.handleLogin);
router.post("/refresh", auth.handleRefreshToken);

export default router;
