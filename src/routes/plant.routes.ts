import express from "express";
import * as plantController from "../controllers/plant.controller";
import { protect, authorize } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/", protect, authorize("admin"), plantController.createPlant);

router.get("/", protect, authorize("admin"), plantController.getAllPlants);

router.get("/:id", protect, authorize("admin"), plantController.getPlantById);

router.put("/:id", protect, authorize("admin"), plantController.updatePlant);

router.delete("/:id", protect, authorize("admin"), plantController.deletePlant);

export default router;
