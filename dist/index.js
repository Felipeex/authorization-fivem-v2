"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const v1_1 = require("./v1");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use("/v1", v1_1.V1);
app.listen(5555, () => {
    console.log("authorization api started!");
});
