import express from "express";
import userRoutes from "./user.routes";
import authRoutes from "./auth.routes";
import plantRoutes from "./plant.routes";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/plants", plantRoutes);

export default router;
