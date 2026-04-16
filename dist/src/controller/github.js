"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCookieGitHub = exports.createCookieGitHub = exports.unsyncUserFromGitHub = exports.getUserBranchesByName = exports.getUserRepoByName = exports.syncUserWithGitHub = exports.getUserRepos = void 0;
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const prisma_1 = __importDefault(require("../lib/prisma"));
const to_string_1 = require("../helper/to_string");
const crypt_1 = require("../helper/crypt");
function getLastPage(linkHeader) {
    if (!linkHeader)
        return null;
    const match = linkHeader.match(/page=(\d+)&per_page=\d+>; rel="last"/);
    if (!match)
        return null;
    return parseInt(match[1], 10);
}
const getUserRepos = async (req, res) => {
    const userId = req.userId;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.per_page) || 10, 100);
    const name = req.query.name?.toLowerCase() || "";
    try {
        if (!userId || !(0, uuid_1.validate)(userId)) {
            return res.status(401).json({ message: "Usuário não autenticado" });
        }
        const existUser = await prisma_1.default.user.findFirst({
            where: { id: userId },
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        if (!existUser.github_token ||
            !existUser.github_username ||
            !existUser.github_id) {
            return res.status(404).json({
                message: "Usuário não sincronizado com GitHub, faça login com o github",
            });
        }
        const encrypted = existUser.github_token.replace(/\s/g, "");
        const token = (0, crypt_1.decryptToken)(encrypted);
        if (!token) {
            return res.status(401).json({
                message: "Sincronização com GitHub não encontrada, faça login novamente",
            });
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
        const totalPages = getLastPage(response.headers.link);
        return res.json({
            data: response.data,
            meta: {
                page,
                per_page: limit,
                total_pages: totalPages,
            },
        });
    }
    catch (error) {
        return res.status(400).json({
            message: "Erro na sincronização com GitHub, por favor, sincronize novamente",
        });
    }
};
exports.getUserRepos = getUserRepos;
const syncUserWithGitHub = async (req, res) => {
    const userId = req.userId;
    const { github_username, github_token, github_user_id } = req.body;
    if (!github_username || !github_token || !github_user_id) {
        return res.status(400).json({ message: "Dados do GitHub não fornecidos" });
    }
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma_1.default.user.findFirst({
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
        await prisma_1.default.user.update({
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
            error: error instanceof Error ? error.message : "Erro desconhecido",
        });
    }
};
exports.syncUserWithGitHub = syncUserWithGitHub;
const getUserRepoByName = async (req, res) => {
    const userId = req.userId;
    const repo = (0, to_string_1.q)(req.params.repo); // nome do repo
    const owner = (0, to_string_1.q)(req.params.owner); // dono do repo (opcional, se não fornecer, busca em todos os repositórios do usuário)
    try {
        if (!userId || !(0, uuid_1.validate)(userId)) {
            return res.status(401).json({ message: "Usuário não autenticado" });
        }
        const existUser = await prisma_1.default.user.findFirst({
            where: { id: userId },
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        if (!existUser.github_token || !existUser.github_username) {
            return res.status(404).json({
                message: "Usuário não sincronizado com GitHub",
            });
        }
        const encrypted = existUser.github_token;
        const token = (0, crypt_1.decryptToken)(encrypted);
        if (!token) {
            return res.status(401).json({
                message: "Token inválido, faça login novamente",
            });
        }
        const response = await axios_1.default.get(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github+json",
            },
        });
        return res.json(response.data);
    }
    catch (error) {
        console.error(error?.response?.data || error.message);
        if (error.response?.status === 404) {
            return res.status(404).json({ message: "Repositório não encontrado" });
        }
        return res.status(500).json({
            message: "Erro ao buscar repositório",
        });
    }
};
exports.getUserRepoByName = getUserRepoByName;
const getUserBranchesByName = async (req, res) => {
    const userId = req.userId;
    const repo = (0, to_string_1.q)(req.params.repo);
    const owner = (0, to_string_1.q)(req.params.owner);
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.per_page) || 10, 100);
    const name = req.query.name?.toLowerCase() || "";
    try {
        if (!userId || !(0, uuid_1.validate)(userId)) {
            return res.status(401).json({ message: "Usuário não autenticado" });
        }
        const existUser = await prisma_1.default.user.findFirst({
            where: { id: userId },
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        if (!existUser.github_token || !existUser.github_username) {
            return res.status(404).json({
                message: "Usuário não sincronizado com GitHub",
            });
        }
        const token = (0, crypt_1.decryptToken)(existUser.github_token);
        if (!token) {
            return res.status(401).json({
                message: "Token inválido, faça login novamente",
            });
        }
        // 🔹 request com paginação nativa do GitHub
        const response = await axios_1.default.get(`https://api.github.com/repos/${owner}/${repo}/branches`, {
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github+json",
            },
            params: {
                page,
                per_page: limit,
            },
        });
        if (response.status !== 200) {
            return res.status(response.status).json({
                message: "Erro ao buscar branches",
            });
        }
        let branches = response.data;
        // 🔹 filtro por nome (search)
        if (name) {
            branches = branches.filter((branch) => branch.name.toLowerCase().includes(name));
        }
        // 🔹 total de páginas (pegando do header link)
        const totalPages = getLastPage(response.headers.link);
        return res.json({
            data: branches,
            meta: {
                page,
                per_page: limit,
                total_pages: totalPages,
            },
        });
    }
    catch (error) {
        console.error(error?.response?.data || error.message);
        if (error.response?.status === 404) {
            return res.status(404).json({ message: "Repositório não encontrado" });
        }
        return res.status(500).json({
            message: "Erro ao buscar branches",
        });
    }
};
exports.getUserBranchesByName = getUserBranchesByName;
const unsyncUserFromGitHub = async (req, res) => {
    const userId = req.userId;
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma_1.default.user.findFirst({
        where: { id: userId },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    if (!existUser.github_token &&
        !existUser.github_username &&
        !existUser.github_id) {
        return res
            .status(400)
            .json({ message: "Usuário já não está sincronizado com GitHub" });
    }
    try {
        await prisma_1.default.user.update({
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
