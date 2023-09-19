import { Request, Response, Router } from "express";
import { z } from "zod";
import { ValidateSchema } from "../../utils/validate-schema";
import { prisma } from "../../../database/client";
const router = Router();

const getProductSchema = z.object({
  params: z.object({
    guildId: z.string({ required_error: "guildId is required" }),
  }),
});

type getProductType = z.infer<typeof getProductSchema> &
  Omit<Request, "params">;

router.get(
  "/get-products/:guildId",
  ValidateSchema(getProductSchema),
  async (req: Request, res: Response) => {
    const {
      params: { guildId },
    } = req as getProductType;

    try {
      const products = await prisma.user.findUnique({
        where: { guildId },
        select: { products: true },
      });
      res.send(products);
    } catch (err: any) {
      console.log(err);
      if (err && err.message) {
        return res.status(400).send({ message: err.message });
      }
    }
  }
);

export { router as Discord };
