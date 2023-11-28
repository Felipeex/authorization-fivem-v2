import { $Enums } from "@prisma/client";
import axios from "axios";
import { fetchServer } from "cfx-api";
import { createHash } from "crypto";
import { NextFunction, Request, Response, Router } from "express";
import { prisma } from "../../database/client";

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
  const { KeymasterId, hwid, script } = req.body as AuthorizationProps;
  const clientIPPerExpress = req.ip;

  if (!KeymasterId || !hwid || !script)
    return res.send({
      message: "^1ERROR: Todos campos precisa ser preenchido.",
      version: "1.0.0",
    });

  try {
    const server = await fetchServer(KeymasterId);

    const isExistIp = server?.data.connectEndPoints.map((ip) => {
      if (ip === clientIPPerExpress) return true;
    });

    console.log(isExistIp)

    if (!isExistIp) {
      return res.send({
        message:
          '^1ERROR: Seu IP não está batendo com seu "KeymasterId", atualize-o',
        version: "1.0.0",
      });
    }

    const findIp = await prisma.consumer.findUnique({
      where: { ip: clientIPPerExpress },
    });

    if (!findIp)
      return res.send({
        message: "^1ERROR: Seu IP não foi encontrado.",
        version: "1.0.0",
      });

    if (findIp.hwid && findIp.hwid === hwid)
      return res.send({
        message: "^1ERROR: Seu HWID está invalido.",
        version: "1.0.0",
      });

    const findProduct = await prisma.consumersOnProducts.findFirst({
      where: { consumerId: findIp.id, product: { name: script } },
      select: {
        product: {
          select: {
            version: true,
            files: true,
            fxmanifest: true
          },
        },
      },
    });

    if (!findProduct)
      return res.send({
        message: "^1ERROR: Seu produto não foi encontrado.",
        version: "1.0.0",
      });

    req.body.product = findProduct;
    next();
  } catch (err) {
    return res.send({
      message: '^1ERROR: Seu "KeymasterId" está incorreto.',
      version: "1.0.0",
    });
  }
}

router.post("/version", async (req: Request, res: Response) => {
  const { productId } = req.body;

  if (productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        version: true,
      },
    });

    return res.send(product?.version);
  }

  return res.status(500).send("productId not found");
});

router.post("/", handleAuthorization, (req: Request, res: Response) => {
  const { code, time } = req.body;
  const currentDate = new Date();

  if (!time || !code)
    return res.send({
      message: "^1ERROR: Todos campos precisa ser preenchido.",
      version: "1.0.0",
    });

  const hash = createHash("sha256").update(time).digest("hex");

  if (code !== hash)
    return res.send({
      message: "^1ERROR: Tempo expirado (hash no found).",
      version: "1.0.0",
    });

  if (Math.abs(currentDate.getTime() / 1000 - time + 10800) >= 60)
    return res.send({
      message: "^1ERROR: Tempo expirado (timeout).",
      version: "1.0.0",
    });

  res.send({
    message: "Autenticado!",
    time: ((time / 384.737463463764) * 3847374.63463764) / 38473.746,
    version: "1.0.0",
  });
});

interface ProductType {
  product: {
    version: string;
    fxmanifest: string
    files: {
      productId: string;
      id: string;
      name: string;
      side: $Enums.sideFile;
      code: string;
    }[];
  };
}

interface obfuscateCodeProps {
  message: string;
  code: string;
}

async function obfuscateCode(name: string, code: string) {
  if (!name) return;
  try {
    const response = await axios.post<obfuscateCodeProps>(
      `${process.env.OBFUSCATE_API!}/v1/obfuscate`,
      {
        token: process.env.OBFUSCATE_TOKEN!,
        name,
        code,
      }
    );
    return response.data.code;
  } catch (error) {
    console.log(error);
  }
}

router.post(
  "/install",
  handleAuthorization,
  async (req: Request, res: Response) => {
    const { product } = req.body.product as ProductType;
    res.send({
      message: "Autenticado!",
      clients: await Promise.all(
        product.files
          .filter((index) => index.side === "client")
          .map(async ({ name, code }) => {
            return {
              name,
              code: await obfuscateCode(name, defaultCodeClient(code)),
            };
          })
      ),
      servers: await Promise.all(
        product.files
          .filter((index) => index.side === "server")
          .map(async ({ name, code, productId }) => {
            return {
              name,
              code: await obfuscateCode(
                name,
                defaultCodeServer(
                  "https://api.fivemshop.com.br/auth/v1/authorization/",
                  productId,
                  code
                )
              ),
            };
          })
      ),
      fxmanifest: `fx_version "adamant"
game "gta5"
lua54 "yes"

shared_scripts {"auth/config.lua"}
${product.fxmanifest ?? ""}

script_version "${product.version}"

server_scripts {"auth/authorization.lua",${product.files
        .filter((index) => index.side === "server")
        .map(({ name }) => {
          return `"${name}"`;
        })}}
client_scripts {${product.files
        .filter((index) => index.side === "client")
        .map(({ name }) => {
          return `"${name}"`;
        })}}`,
      version: product.version,
    });
  }
);

function defaultCodeClient(code?: string) {
  return `
  CreateThread(function()
    TriggerServerEvent(GetCurrentResourceName())
  end)
  RegisterNetEvent(GetCurrentResourceName())
  AddEventHandler(GetCurrentResourceName(), function(state)
    if (state) then
      ${code}
    end
  end)
  `;
}

function defaultCodeServer(url: string, productId: string, code?: string) {
  return `CreateThread(function()
  if not (Authorization.isReWritingFunction()) then
      PerformHttpRequest("${url}", function(err, data)
        print("Loading...")
        if (data) then data = json.decode(data) end
          if (data and data["time"]) then
            if ((((Timestamp() / 384.737463463764) * 3847374.63463764) / 38473.746) - data["time"] <= 60) then
              Authorization.handler(err, data, "${productId}")
              ${code}
            else
              Authorization.print("ERROR:", "Tempo expirado (timeout-script)")
            end
          else
            Authorization.handler(err, data, "${productId}")
        end
      end, Authorization.Send(tostring(Timestamp()), cb(tostring(Timestamp()))))
    else
      Authorization.print("CUIDADO", "Você não pode alterar nosso código.")
    end
  end)

  RegisterNetEvent(GetCurrentResourceName())
  AddEventHandler(GetCurrentResourceName(), function()
    if not (Authorization.isReWritingFunction()) then
      PerformHttpRequest("${url}", function(err, data)
        if (data) then data = json.decode(data) end
          if (data and data["time"]) then
            if ((((Timestamp() / 384.737463463764) * 3847374.63463764) / 38473.746) - data["time"] <= 60) then
              TriggerClientEvent(GetCurrentResourceName(), -1, true)
            else
              TriggerClientEvent(GetCurrentResourceName(), -1, false)
            end
        end
      end, Authorization.Send(tostring(Timestamp()), cb(tostring(Timestamp()))))
    end
  end)
  `;
}

export { router as Authorization };

