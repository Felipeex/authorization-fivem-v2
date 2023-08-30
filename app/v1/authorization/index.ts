import { Router, Request, Response } from "express";
const router = Router();

interface AuthorizationProps {
  script: string;
  hwid: string;
  KeymasterId: string;
}

router.post("/", (req: Request, res: Response) => {
  /* const { KeymasterId, hwid, script } = req.body as AuthorizationProps;
  const clientIPPerExpress =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  console.log(KeymasterId, hwid, script, clientIPPerExpress); */

  res.send({ message: "Autenticado!", version: "1.0.0" });
});

router.post("/update", (req: Request, res: Response) => {
  res.send({
    message: "Autenticado!",
    clients: [{ name: "client.lua", code: "print('client')" }],
    servers: [{ name: "server.lua", code: "print('server')" }],
    version: "1.0.0",
  });
});

export { router as Authorization };
