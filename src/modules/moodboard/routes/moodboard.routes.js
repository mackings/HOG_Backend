import { Router } from "express";
import { isAuth } from "../../../middlewares/auth.middleware.js";
import { userCheckRole } from "../../../middlewares/checkRole.middleware.js";
import { addMoodboardItem, createMoodboard, getMoodboards, removeMoodboardItem } from "../controller/moodboard.controller.js";
import { imageUpload, optionalImageKitUpload } from "../../../utils/imagekit.js";

const router = Router();

router.use(isAuth);
router.use(userCheckRole(["user", "tailor", "admin"]));
router.post("/", createMoodboard);
router.get("/", getMoodboards);
router.post("/:moodboardId/items", imageUpload, optionalImageKitUpload, addMoodboardItem);
router.delete("/:moodboardId/items/:itemId", removeMoodboardItem);

export default router;
