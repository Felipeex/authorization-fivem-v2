import { randomUUID } from "crypto";
import { Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../../../database/client";
import { ValidateSchema } from "../../utils/validate-schema";
const router = Router();

const getProductSchema = z.object({
  params: z.object({
    guildId: z.string({ required_error: "guildId is required" }),
  }),
});

type getProductType = z.infer<typeof getProductSchema> &
  Omit<Request, "params">;

router.get("/verify-token/:guildId", ValidateSchema(getProductSchema), async (req: Request, res: Response) => {
  const {
    params: { guildId },
  } = req as getProductType;

  try {
    const products = await prisma.user.findUnique({
      where: { guildId },
    });
    
    if (!products) {
      return res.sendStatus(404)
    }

    res.sendStatus(200);
  } catch (err: any) {
    console.log(err);
    if (err && err.message) {
      return res.status(400).send({ message: err.message });
    }
  }
})

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

const createConsumerSchema = z.object({
  body: z.object({
    id: z.string({ required_error: "id is required" }),
  }),
});

type createConsumerType = z.infer<typeof createConsumerSchema> &
  Omit<Request, "body">;

router.post(
  "/consumer",
  ValidateSchema(createConsumerSchema),
  async (req: Request, res: Response) => {
    const {
      body: { id },
    } = req as createConsumerType;

    try {
      const findConsumer = await prisma.consumer.findUnique({
        where: {
          discordId: id
        }
      })

      if (!findConsumer) {
        const created = await prisma.consumer.create({
          data: {
            discordId: id,
            ip: randomUUID()
          }
        })

        return res.send(created).status(201)
      }
    } catch (err: any) {
      console.log(err);
      if (err && err.message) {
        return res.status(400).send({ message: err.message });
      }
    }
  })

const createProductSchema = z.object({
  body: z.object({
    id: z.string({ required_error: "id is required" }),
    productId: z.string({ required_error: "productId is required" }),
    ip: z.string({ required_error: "ip is required" }),
  }),
});

type createProductType = z.infer<typeof createProductSchema> &
  Omit<Request, "body">;

router.post(
  "/product",
  ValidateSchema(createProductSchema),
  async (req: Request, res: Response) => {
    const {
      body: { id, productId, ip },
    } = req as createProductType;

    try {
      console.log(id, productId)
      const findConsumerByIp = await prisma.consumer.findUnique({
        where: {
          ip
        }
      })

      if (findConsumerByIp && id !== findConsumerByIp.discordId) return res.sendStatus(409)

      var findConsumer = await prisma.consumer.findUnique({
        where: {
          discordId: id
        }
      })

      if (!findConsumer) {
        const created = await prisma.consumer.create({
          data: {
            discordId: id,
            ip
          }
        })

        findConsumer = created
      }

      const findConsumerOnProduct = await prisma.consumersOnProducts.findUnique({
          where: {
            consumerId: findConsumer.id,
            productId,
            consumerId_productId: {
              consumerId: findConsumer.id,
              productId
            }
          }
        })

      if (findConsumerOnProduct) return res.send(200);

      const createConsumerOrInsertProductInConsumer = await prisma.consumersOnProducts.create({
        data: {
          consumerId: findConsumer.id,
          productId,
        }
      })

      await prisma.consumer.update({
        where: {
          id: createConsumerOrInsertProductInConsumer.consumerId
        },
        data: {
          ip
        }
      })

      return res.send(createConsumerOrInsertProductInConsumer).status(201)
    } catch (err: any) {
      console.log(err);
      if (err && err.message) {
        return res.status(400).send({ message: err.message });
      }
    }
  }
);

export { router as Discord };

