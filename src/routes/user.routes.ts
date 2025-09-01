import express from "express";
import * as userController from "../controllers/user.controller";
import { protect, authorize } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/", protect, authorize("admin"), userController.createUser);
router.get("/", protect, authorize("admin"), userController.getAllUsers);
router.get("/:id", protect, authorize("admin"), userController.getUserById);
router.put("/:id", protect, authorize("admin"), userController.updateUser);
router.delete("/:id", protect, authorize("admin"), userController.deleteUser);

export default router;
