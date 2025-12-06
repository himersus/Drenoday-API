"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const AuthUser = async (req, res, next) => {
    const HeaderAuthorization = req.headers['authorization'];
    if (!HeaderAuthorization) {
        return res.status(401).json({ message: "Token não fornecido" });
    }
    const token = HeaderAuthorization.replace('Bearer ', '');
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        next();
    }
    catch (error) {
        return res.status(401).json({ message: "Token inválido" });
    }
};
exports.AuthUser = AuthUser;
