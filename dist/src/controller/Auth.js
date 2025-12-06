"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const login = async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    { email: username }
                ]
            }
        });
        if (!user) {
            return res.status(401).json({ message: "Usuário ou senha inválida" });
        }
        const isValidPassword = await bcrypt_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Usuário ou senha inválida" });
        }
        const payload = { id: user.id, username: user.username, email: user.email };
        const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET);
        res.status(200).json({ token });
    }
    catch (error) {
        return res.status(500).json({ message: "O login falhou" });
    }
};
exports.login = login;
