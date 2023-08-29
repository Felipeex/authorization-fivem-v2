import { Router, Request, Response } from "express";
const router = Router();

interface AuthorizationProps {
  script: string;
  hwid: string;
  KeymasterId: string;
}

router.post("/", (req: Request, res: Response) => {
  const { KeymasterId, hwid, script } = req.body as AuthorizationProps;
  const clientIPPerExpress =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  console.log(KeymasterId, hwid, script, clientIPPerExpress);
});

export { router as Authorization };
