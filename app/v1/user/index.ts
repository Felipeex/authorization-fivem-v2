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

export { router as User };
