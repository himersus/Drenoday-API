"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuthenticationAdmin = exports.verifyAuthentication = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const jwtSecret = process.env.JWT_SECRET;
const verifyAuthentication = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
            message: "Usuário não autenticado. Por favor, faça login."
        });
        return;
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.userId = decoded.id;
        (async () => {
            const user = await prisma.user.findFirst({
                where: {
                    id: decoded.id,
                },
            });
            if (!user) {
                res.status(401).json({
                    message: "Usuário não encontrado. Por favor, faça login novamente."
                });
                return;
            }
            if (user.is_active === false) {
                res.status(400).json({
                    message: "Conta inativa. Por favor, ative sua conta."
                });
                return;
            }
        })();
    }
    catch (error) {
        res.status(401).json({
            message: "Usuário não autenticado. Por favor, faça login."
        });
        return;
    }
    next();
};
exports.verifyAuthentication = verifyAuthentication;
const verifyAuthenticationAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
            message: "Usuário não autenticado. Por favor, faça login."
        });
        return;
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.userId = decoded.id;
        (async () => {
            const user = await prisma.user.findFirst({
                where: {
                    id: decoded.id,
                },
            });
            if (!user) {
                res.status(401).json({
                    message: "Usuário não encontrado. Por favor, faça login novamente."
                });
                return;
            }
            if (user.is_active === false) {
                res.status(400).json({
                    message: "Conta inativa. Por favor, ative sua conta."
                });
                return;
            }
            if (user.roleUser !== 'admin') {
                res.status(403).json({
                    message: "Acesso negado. Você não tem permissão para acessar este recurso."
                });
                return;
            }
        })();
    }
    catch (error) {
        res.status(401).json({
            message: "Usuário não autenticado. Por favor, faça login."
        });
        return;
    }
    next();
};
exports.verifyAuthenticationAdmin = verifyAuthenticationAdmin;
