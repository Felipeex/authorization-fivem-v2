import { Router } from "express";
import { Authorization } from "./authorization";
import { User } from "./user";

export const router = Router();
router.use("/authorization", Authorization);
router.use("/user", User);

export { router as V1 };
