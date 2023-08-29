import { Router } from "express";
import { Authorization } from "./authorization";

export const router = Router();
router.use("/authorization", Authorization);

export { router as V1 };
