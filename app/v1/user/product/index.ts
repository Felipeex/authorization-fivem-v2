import { Request, Response, Router } from "express";
import {
  UserjwtVerify,
  UserjwtVerifySchema,
} from "../../utils/user-jwt-verify";
import { z } from "zod";
import { ValidateSchema } from "../../utils/validate-schema";
import { prisma } from "../../../database/client";
const router = Router();

const productSchema = z.object({
  body: z.object({
    userToken: UserjwtVerifySchema,
    name: z.string({ required_error: "name is required" }),
    version: z.string({ required_error: "version is required" }),
    files: z.array(
      z.object({
        name: z.string({ required_error: "name is required" }),
        side: z.enum(["client", "server"], {
          required_error: "side is required",
        }),
        code: z.string({ required_error: "code is required" }),
      }),
      { required_error: "file is required" }
    ),
  }),
});

type productType = z.infer<typeof productSchema> & Omit<Request, "body">;

router.get("/", UserjwtVerify, async (req: Request, res: Response) => {
  const { userToken } = req.body;

  try {
    const findProducts = await prisma.user.findUnique({
      where: {
        discordId: userToken.id,
      },
      select: {
        products: true,
      },
    });
    res.send(findProducts);
  } catch (err: any) {
    console.log(err);
    if (err && err.message) {
      return res.status(400).send({ message: err.message });
    }
  }
});

const findProductSchema = z.object({
  params: z.object({
    id: z.string({ required_error: "id is required" }),
  }),
});

type findProductType = z.infer<typeof findProductSchema> &
  Omit<Request, "params">;

router.get(
  "/:id",
  [UserjwtVerify, ValidateSchema(findProductSchema)],
  async (req: Request, res: Response) => {
    const { userToken } = req.body;
    const { params } = req as findProductType;

    try {
      const findProducts = await prisma.user.findUnique({
        where: {
          discordId: userToken.id,
        },
        select: {
          products: {
            where: {
              id: params.id,
            },
            include: {
              files: true,
            },
          },
        },
      });
      res.send(findProducts);
    } catch (err: any) {
      console.log(err);
      if (err && err.message) {
        return res.status(400).send({ message: err.message });
      }
    }
  }
);

router.post(
  "/",
  [UserjwtVerify, ValidateSchema(productSchema)],
  async (req: Request, res: Response) => {
    const { body }: productType = req;

    const userExist = await prisma.user.findUnique({
      where: { discordId: body.userToken?.id },
    });
    if (!userExist) return res.status(400).send({ error: "user not exist" });

    const productExist = await prisma.product.findFirst({
      where: { ownerId: userExist.id, name: body.name },
    });
    if (productExist?.name === body.name)
      return res.status(400).send({ error: "product name exist" });

    try {
      await prisma.product.create({
        data: {
          name: body.name,
          version: body.version,
          files: {
            create: body.files,
          },
          ownerId: userExist.id,
        },
      });
    } catch (err: any) {
      console.log(err);
      if (err && err.message) {
        return res.status(400).send({ message: err.message });
      }
    }
    res.sendStatus(200);
  }
);

router.put(
  "/:id",
  [UserjwtVerify, ValidateSchema(productSchema)],
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { body }: productType = req;

    if (!(await prisma.product.findUnique({ where: { id } })))
      return res.status(400).send({ message: "product not exist." });

    try {
      await prisma.product.update({
        where: {
          id,
        },
        data: {
          name: body.name,
          version: body.version,
        },
      });

      body.files.map(async (updateFile) => {
        // @ts-ignore
        const updateFileId = updateFile?.id;
        if (updateFileId) {
          await prisma.file.update({
            where: { id: updateFileId },
            data: {
              ...updateFile,
            },
          });
        } else {
          await prisma.product.update({
            where: {
              id,
            },
            data: {
              files: {
                create: {
                  ...updateFile,
                },
              },
            },
          });
        }
      });

      const allFiles = await prisma.file.findMany({ where: { productId: id } });
      const filesForDelete = allFiles.filter(
        (files) =>
          !body.files.find(
            (updatedFiles) =>
              // @ts-ignore
              updatedFiles.id === files.id
          )
      );
      filesForDelete.map(async (deleteFile) => {
        await prisma.file.delete({ where: { id: deleteFile.id } });
      });
    } catch (err: any) {
      console.log(err);
      if (err && err.message) {
        return res.status(400).send({ message: err.message });
      }
    }
    res.sendStatus(200);
  }
);

router.delete("/:id", UserjwtVerify, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!(await prisma.product.findUnique({ where: { id } })))
    return res.status(400).send({ message: "product not exist." });

  try {
    await prisma.product.delete({
      where: {
        id,
      },
    });
  } catch (err: any) {
    console.log(err);
    if (err && err.message) {
      return res.status(400).send({ message: err.message });
    }
  }
  res.sendStatus(200);
});

export { router as Product };
