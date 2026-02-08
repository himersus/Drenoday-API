"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCookieGitHub = exports.createCookieGitHub = exports.unsyncUserFromGitHub = exports.syncUserWithGitHub = exports.getUserRepos = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_js_1 = __importDefault(require("crypto-js"));
const uuid_1 = require("uuid");
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const getUserRepos = async (req, res) => {
    const userId = req.userId;
    const page = req.params.page || 1;
    const limit = req.params.limit || 10;
    const offset = limit * page - limit;
    const name = req.query.name || "";
    try {
        if (!userId || !(0, uuid_1.validate)(userId)) {
            return res.status(401).json({ message: "Usuário não autenticado" });
        }
        const existUser = await prisma.user.findFirst({
            where: { id: userId },
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        if (!existUser.github_token || !existUser.github_username || !existUser.github_id) {
            return res
                .status(404)
                .json({
                message: "Usuário não sincronizado com GitHub, faça login com o github",
            });
        }
        const encrypted = existUser.github_token;
        const token = crypto_js_1.default.AES.decrypt(encrypted, process.env.GITHUB_TOKEN_ENCRYPTION_KEY).toString(crypto_js_1.default.enc.Utf8);
        if (!token) {
            return res.status(401).json({ message: "Token não fornecido" });
        }
        const response = await axios_1.default.get("https://api.github.com/user/repos", {
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github+json",
            },
            params: {
                affiliation: "owner,collaborator,organization_member",
                sort: "updated",
                direction: "desc",
                page,
                per_page: limit,
            },
        });
        if (response.status !== 200) {
            return res
                .status(response.status)
                .json({ message: "Erro ao buscar repositórios" });
        }
        if (name) {
            response.data = response.data.filter((repo) => repo.name.toLowerCase().includes(name.toLowerCase()));
        }
        return res.json(response.data);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Erro ao buscar repositórios",
            error: error instanceof Error ? error.message : "Erro desconhecido"
        });
    }
};
exports.getUserRepos = getUserRepos;
const syncUserWithGitHub = async (req, res) => {
    const userId = req.userId;
    const { github_username, github_token, github_user_id } = req.cookies;
    if (!github_username || !github_token || !github_user_id) {
        return res.status(400).json({ message: "Dados do GitHub não fornecidos" });
    }
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma.user.findFirst({
        where: { id: userId },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    /*const encryptedToken = CryptoJS.AES.encrypt(
      github_token,
      process.env.GITHUB_TOKEN_ENCRYPTION_KEY!,
    ).toString();*/
    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                github_username,
                github_token: github_token,
                github_id: github_user_id,
            },
        });
        return res
            .status(200)
            .json({ message: "Sincronização com GitHub realizada com sucesso" });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Erro ao sincronizar com GitHub",
            error: error instanceof Error ? error.message : "Erro desconhecido"
        });
    }
};
exports.syncUserWithGitHub = syncUserWithGitHub;
const unsyncUserFromGitHub = async (req, res) => {
    const userId = req.userId;
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma.user.findFirst({
        where: { id: userId },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    if (!existUser.github_token && !existUser.github_username && !existUser.github_id) {
        return res
            .status(400)
            .json({ message: "Usuário já não está sincronizado com GitHub" });
    }
    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                github_username: null,
                github_token: null,
                github_id: null,
            },
        });
        return res
            .status(200)
            .json({ message: "Desconexão do GitHub realizada com sucesso" });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao desconectar do GitHub" });
    }
};
exports.unsyncUserFromGitHub = unsyncUserFromGitHub;
const createCookieGitHub = (req, res) => {
    res.cookie("teste", "TEsteeeeee", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 dia
    });
    return res.status(200).json({ message: "Cookie criado com sucesso" });
};
exports.createCookieGitHub = createCookieGitHub;
const readCookieGitHub = (req, res) => {
    return res.json(req.cookies);
};
exports.readCookieGitHub = readCookieGitHub;
