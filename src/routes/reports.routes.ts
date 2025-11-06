import { Router } from "express";
import {
  dailyReportHandler,
  hourlyReportHandler,
  monthlyReportHandler,
  recalculateHourlyHandler,
} from "../controllers/reports.controller";
import { authorize, protect } from "../middlewares/auth.middleware";

const router = Router();

const REPORTS_AUTH_DISABLED =
  (process.env.REPORTS_AUTH_DISABLED ?? "false").toLowerCase() === "true";

if (!REPORTS_AUTH_DISABLED) {
  router.use(protect);
}

router.get("/hourly", hourlyReportHandler);
router.get("/daily", dailyReportHandler);
router.get("/monthly", monthlyReportHandler);

if (REPORTS_AUTH_DISABLED) {
  router.post("/hourly/recalculate", recalculateHourlyHandler);
} else {
  router.post(
    "/hourly/recalculate",
    authorize("admin"),
    recalculateHourlyHandler
  );
}

export default router;
