import { Router } from "express";
import { athenaController } from "../controllers/athena.controller";
import { asyncHandler } from "../middleware/asyncHandler";

export const athenaRouter = Router();
athenaRouter.post("/chat", asyncHandler(athenaController.chat));
