"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEnvVar = exports.getEnvVars = exports.saveEnvVars = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const crypt_1 = require("../utils/crypt");
const to_string_1 = require("../utils/to_string");
const saveEnvVars = async (req, res) => {
    const userId = req.userId;
    const projectId = (0, to_string_1.q)(req.params.projectId);
    const { environments } = req.body; // [{ key: "DATABASE_URL", value: "postgres://..." }]
    const existUser = await prisma_1.default.user.findUnique({
        where: { id: userId },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const members = await prisma_1.default.user_workspace.findMany({
        where: { userId, projectId },
    });
    if (members.length === 0) {
        return res
            .status(403)
            .json({ message: "Você não tem acesso a este projeto" });
    }
    const project = await prisma_1.default.project.findFirst({
        where: { id: projectId, userId },
    });
    if (!project) {
        return res.status(404).json({ message: "Projeto não encontrado" });
    }
    // Criptografa e salva cada var
    const upserts = environments.map(({ key, value }) => prisma_1.default.environment.upsert({
        where: { projectId_key: { projectId, key } },
        update: { value: (0, crypt_1.encryptEnv)(value) },
        create: { projectId, key, value: (0, crypt_1.encryptEnv)(value) },
    }));
    await prisma_1.default.$transaction(upserts);
    return res.status(200).json({ message: "Variáveis salvas com sucesso" });
};
exports.saveEnvVars = saveEnvVars;
const getEnvVars = async (req, res) => {
    const userId = req.userId;
    const projectId = (0, to_string_1.q)(req.params.projectId);
    const page = parseInt((0, to_string_1.q)(req.query.page) || "1");
    const per_page = parseInt((0, to_string_1.q)(req.query.per_page) || "10");
    const existUser = await prisma_1.default.user.findFirst({
        where: { id: userId },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const members = await prisma_1.default.user_workspace.findMany({
        where: { userId, projectId },
    });
    if (members.length === 0) {
        return res
            .status(403)
            .json({ message: "Você não tem acesso a este projeto" });
    }
    const project = await prisma_1.default.project.findFirst({
        where: { id: projectId, userId },
    });
    if (!project) {
        return res.status(404).json({ message: "Projeto não encontrado" });
    }
    const vars = await prisma_1.default.environment.findMany({
        where: { projectId },
        select: {
            id: true,
            key: true,
            projectId: true,
            createdAt: true,
            updatedAt: true,
        }, // nunca retorna o value
    });
    const count = await prisma_1.default.environment.count({
        where: { projectId },
    });
    return res.status(200).json({
        data: vars,
        meta: {
            page: page,
            per_page: per_page,
            total: count,
            total_pages: Math.ceil(count / per_page),
        },
    });
};
exports.getEnvVars = getEnvVars;
const deleteEnvVar = async (req, res) => {
    const userId = req.userId;
    const projectId = (0, to_string_1.q)(req.params.projectId);
    const envId = (0, to_string_1.q)(req.params.envId);
    const existUser = await prisma_1.default.user.findUnique({
        where: { id: userId },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const members = await prisma_1.default.user_workspace.findMany({
        where: { userId, projectId },
    });
    if (members.length === 0) {
        return res
            .status(403)
            .json({ message: "Você não tem acesso a este projeto" });
    }
    const project = await prisma_1.default.project.findFirst({
        where: { id: projectId, userId },
    });
    if (!project) {
        return res.status(404).json({ message: "Projeto não encontrado" });
    }
    const existEnv = await prisma_1.default.environment.findFirst({
        where: { id: envId, projectId },
    });
    if (!existEnv) {
        return res
            .status(404)
            .json({ message: "Variável de ambiente não encontrada" });
    }
    await prisma_1.default.environment.delete({
        where: { id: envId },
    });
    return res.status(200).json({ message: "Variável deletada com sucesso" });
};
exports.deleteEnvVar = deleteEnvVar;
