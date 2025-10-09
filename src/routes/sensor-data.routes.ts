import { Router } from "express";
import {
  latestSensorReadings,
  rawSensorData,
  sensorReport,
} from "../controllers/sensor-data.controller";

const router = Router();

router.get("/latest", latestSensorReadings);
router.get("/report", sensorReport);
router.get("/raw", rawSensorData);

export default router;
