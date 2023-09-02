"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.V1 = exports.router = void 0;
const express_1 = require("express");
const authorization_1 = require("./authorization");
exports.router = (0, express_1.Router)();
exports.V1 = exports.router;
exports.router.use("/authorization", authorization_1.Authorization);
