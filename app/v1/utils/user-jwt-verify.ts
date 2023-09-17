import { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";
import { z } from "zod";

export const UserjwtVerifySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    picture: z.string(),
  })
  .optional();

export function UserjwtVerify(req: Request, res: Response, next: NextFunction) {
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
