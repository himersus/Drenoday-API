"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUser = exports.UserLoged = exports.getAllUsers = exports.getUser = exports.createUser = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const username_1 = require("../modify/username");
const uuid_1 = require("uuid");
const bcrypt_1 = __importDefault(require("bcrypt"));
const to_string_1 = require("../helper/to_string");
const prisma_1 = __importDefault(require("../lib/prisma"));
const createUser = async (req, res) => {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
        return res.status(400).json({ message: "Email, nome e senha são obrigatórios" });
    }
    const username = await (0, username_1.generateUniqueUsername)(name);
    if (!username || !name) {
        return res.status(400).json({
            message: "O nome fornecido não é válido para gerar um nome de usuário."
        });
    }
    try {
        const existUser = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { email },
                    { username }
                ]
            },
        });
        if (existUser) {
            return res.status(400).json({ message: "Usuário com este email ou username já existe." });
        }
        const user = await prisma_1.default.user.create({
            data: {
                email,
                name,
                password: await bcrypt_1.default.hash(password, 10),
                username: username,
            }
        });
        res.status(201).json(user);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create user" });
    }
};
exports.createUser = createUser;
const getUser = async (req, res) => {
    const userId = (0, to_string_1.q)(req.params.userId);
    try {
        const user = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { id: (0, uuid_1.validate)(userId) ? userId : undefined },
                    { username: userId },
                    { email: userId }
                ]
            },
        });
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        res.status(200).json(user);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to retrieve user" });
    }
};
exports.getUser = getUser;
const getAllUsers = async (req, res) => {
    const { username } = req.query;
    if (username && typeof username !== 'string') {
        return res.status(400).json({ message: "Username inválido" });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    try {
        const users = await prisma_1.default.user.findMany({
            where: {
                username: {
                    contains: username ? username : undefined,
                    mode: "insensitive"
                },
            },
            skip,
            take: limit,
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.status(200).json(users);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to retrieve users" });
    }
};
exports.getAllUsers = getAllUsers;
const UserLoged = async (req, res) => {
    const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        res.status(200).json(user);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to retrieve logged-in user" });
    }
};
exports.UserLoged = UserLoged;
const updateUser = async (req, res) => {
    const userId = req.userId;
    const { email, name } = req.body;
    const existUser = await prisma_1.default.user.findFirst({
        where: {
            OR: [
                { id: (0, uuid_1.validate)(userId) ? userId : undefined },
                { username: userId },
                { email: userId }
            ]
        },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    try {
        const user = await prisma_1.default.user.update({
            where: { id: existUser.id },
            data: {
                email: email || existUser.email,
                name: name || existUser.name
            }
        });
        res.status(200).json(user);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update user" });
    }
};
exports.updateUser = updateUser;
