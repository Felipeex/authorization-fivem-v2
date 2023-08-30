import { Router, Request, Response, NextFunction } from "express";
const router = Router();

interface AuthorizationProps {
  script: string;
  hwid: string;
  KeymasterId: string;
}

async function handleAuthorization(
  req: Request,
  res: Response,
  next: NextFunction
) {
  /* const { KeymasterId, hwid, script } = req.body as AuthorizationProps;
  const clientIPPerExpress =
    req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  console.log(KeymasterId, hwid, script, clientIPPerExpress); */
  next();
}

router.post("/", handleAuthorization, (req: Request, res: Response) => {
  res.send({ message: "Autenticado!", version: "1.0.0" });
});

router.post("/install", handleAuthorization, (req: Request, res: Response) => {
  const url = `${req.protocol}://${req.get("host")}${req.baseUrl}`;
  res.send({
    message: "Autenticado!",
    clients: [{ name: "client.lua", code: "print('client')" }],
    servers: [{ name: "server.lua", code: defaultCodeServer(url) }],
    version: "1.0.0",
  });
});

function defaultCodeServer(url: string, code?: string) {
  return `CreateThread(function()
  if not (Authorization.isReWritingFunction()) then
      Authorization.getIp(function(ip)
        PerformHttpRequest("${url}", function(err, data)
          Authorization.handler(err, json.decode(data))
        end, Authorization.Send())
      end)
    else
      Authorization.print("CUIDADO", "Você não pode alterar nosso código.")
    end
  end)`;
}

export { router as Authorization };
