"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Authorization = void 0;
const express_1 = require("express");
const cfx_api_1 = require("cfx-api");
const crypto_1 = require("crypto");
const client_1 = require("../../database/client");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
exports.Authorization = router;
function handleAuthorization(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const { KeymasterId, hwid, script } = req.body;
        const clientIPPerExpress = 
        /*
        (req.headers["x-forwarded-for"] as string) ||
        (req.socket.remoteAddress as string); */ "167.250.175.163:30120";
        if (!KeymasterId || !hwid || !script)
            return res.send({
                message: "^1ERROR: Todos campos precisa ser preenchido.",
                version: "1.0.0",
            });
        try {
            const server = yield (0, cfx_api_1.fetchServer)(KeymasterId);
            if (!(server === null || server === void 0 ? void 0 : server.data.connectEndPoints.includes(clientIPPerExpress))) {
                return res.send({
                    message: '^1ERROR: Seu IP não está batendo com seu "KeymasterId", atualize-o',
                    version: "1.0.0",
                });
            }
            const findIp = yield client_1.prisma.consumer.findUnique({
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
            const findProduct = yield client_1.prisma.consumersOnProducts.findFirst({
                where: { consumerId: findIp.id, product: { name: script } },
                select: {
                    product: {
                        select: {
                            version: true,
                            files: true,
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
        }
        catch (err) {
            return res.send({
                message: '^1ERROR: Seu "KeymasterId" está incorreto.',
                version: "1.0.0",
            });
        }
    });
}
router.post("/", handleAuthorization, (req, res) => {
    const { code, time } = req.body;
    const currentDate = new Date();
    if (!time || !code)
        return res.send({
            message: "^1ERROR: Todos campos precisa ser preenchido.",
            version: "1.0.0",
        });
    const hash = (0, crypto_1.createHash)("sha256").update(time).digest("hex");
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
function obfuscateCode(name, code) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!name)
            return;
        const response = yield axios_1.default.post(`${process.env.OBFUSCATE_API}/v1/obfuscate`, {
            token: process.env.OBFUSCATE_TOKEN,
            name,
            code,
        });
        return response.data.code;
    });
}
router.post("/install", handleAuthorization, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { product } = req.body.product;
    const url = `${req.protocol}://${req.get("host")}${req.baseUrl}`;
    res.send({
        message: "Autenticado!",
        clients: yield Promise.all(product.files
            .filter((index) => index.side === "client")
            .map(({ name, code }) => __awaiter(void 0, void 0, void 0, function* () {
            return {
                name: name + ".lua",
                code: yield obfuscateCode(name, defaultCodeClient(code)),
            };
        }))),
        servers: yield Promise.all(product.files
            .filter((index) => index.side === "server")
            .map(({ name, code }) => __awaiter(void 0, void 0, void 0, function* () {
            return {
                name: name + ".lua",
                code: yield obfuscateCode(name, defaultCodeServer(url, code)),
            };
        }))),
        version: product.version,
    });
}));
function defaultCodeClient(code) {
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
function defaultCodeServer(url, code) {
    return `CreateThread(function()
  if not (Authorization.isReWritingFunction()) then
      PerformHttpRequest("${url}", function(err, data)
        if (data) then data = json.decode(data) end
          if (data and data["time"]) then
            if ((((Timestamp() / 384.737463463764) * 3847374.63463764) / 38473.746) - data["time"] <= 60) then
              Authorization.handler(err, data)
              ${code}
            else
              Authorization.print("ERROR:", "Tempo expirado (timeout-script)")
            end
          else
            Authorization.handler(err, data)
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
