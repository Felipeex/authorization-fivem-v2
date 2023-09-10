import { NextFunction, Request, Response, Router } from "express";
import { verify } from "jsonwebtoken";
import { prisma } from "../../database/client";
import { differenceInMilliseconds, intlFormatDistance } from "date-fns";
export const router = Router();

export function jwtVerify(req: Request, res: Response, next: NextFunction) {
  const { authorization } = req.headers;
  if (authorization) {
    const token = authorization.split(" ")[1] || null;
    if (token) {
      try {
        const data = verify(token, process.env.JWT_SECRET as string);
        req.body.userToken = data;
        next();
      } catch (err) {
        res.status(400).send({ message: "Not Verify" });
      }
    } else {
      res.status(400).send({ message: "Invalid Token" });
    }
  } else {
    res.status(400).send({ message: "Authorization not found" });
  }
}

router.post("/", async (req: Request, res: Response) => {
  const { id, name } = req.body;

  const findUserById = await prisma.user.findUnique({
    where: { discordId: id },
  });
  if (findUserById) return res.sendStatus(200);
  else await prisma.user.create({ data: { discordId: id, name } });
  res.sendStatus(201);
});

router.post("/plan", async (req: Request, res: Response) => {
  const { token } = req.body;
  if (token) {
    try {
      const data = verify(token, process.env.JWT_SECRET as string) as any;
      if (data && data.id && data.days) {
        const veriftExistPlan = await prisma.user.findUnique({
          where: { discordId: data.id },
          include: { plan: { select: { expireAt: true } } },
        });

        if (!veriftExistPlan?.plan) {
          await prisma.user.update({
            where: { discordId: data.id },
            data: {
              plan: {
                create: {
                  expireAt: new Date(
                    Date.now() + data.days * 24 * 60 * 60 * 1000
                  ),
                },
              },
            },
          });
        } else {
          await prisma.user.update({
            where: { discordId: data.id },
            data: {
              plan: {
                update: {
                  expireAt: new Date(
                    Date.now() + data.days * 24 * 60 * 60 * 1000
                  ),
                },
              },
            },
          });
        }
      } else res.status(400).send({ message: "Token incorrect" });
    } catch (err) {
      res.status(400).send({ message: "Not Verify" });
    }
  } else {
    res.status(400).send({ message: "Invalid Token" });
  }
});

router.get("/me/plan", jwtVerify, async (req: Request, res: Response) => {
  const { userToken } = req.body;
  if (userToken && userToken.id) {
    const findUser = await prisma.user.findUnique({
      where: { discordId: userToken.id },
      select: {
        plan: true,
      },
    });
    const plano = findUser?.plan;
    if (!plano) return res.send(false);
    else {
      if (differenceInMilliseconds(plano.expireAt, new Date()) >= 0) {
        return res.send({
          distance: intlFormatDistance(plano.expireAt, new Date(), {
            numeric: "always",
            locale: "pt",
          }),
          isExpired: false,
        });
      } else {
        return res.send({
          distance: 0,
          isExpired: true,
        });
      }
    }
  } else {
    res.status(400).send({ message: "Token not found" });
  }
});

router.post("/exist", async (req: Request, res: Response) => {
  const { discordId } = req.body;
  if (discordId)
    return res.send(!!(await prisma.user.findUnique({ where: { discordId } })));
  return res.send("discordId not exist");
});

router.get(
  "/me/discordtoken",
  jwtVerify,
  async (req: Request, res: Response) => {
    const { userToken } = req.body;

    if (userToken && userToken.id) {
      const findDiscordToken = await prisma.user.findUnique({
        where: { discordId: userToken.id },
        select: {
          token: true,
        },
      });
      res.send(findDiscordToken?.token);
    } else {
      res.status(400).send({ message: "Token not found" });
    }
  }
);

export { router as User };
