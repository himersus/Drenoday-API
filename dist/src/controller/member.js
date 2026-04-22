"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeMember = exports.addMember = void 0;
const uuid_1 = require("uuid");
const prisma_1 = __importDefault(require("../lib/prisma"));
const addMember = async (req, res) => {
    const { username, projectId, role } = req.body;
    const userId = req.userId;
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    if (role && !['member', 'master'].includes(role)) {
        return res.status(400).json({ message: "Função inválida fornecida" });
    }
    try {
        const existUserLogado = await prisma_1.default.user.findFirst({
            where: { id: userId }
        });
        if (!existUserLogado) {
            return res.status(401).json({ message: "Não autorizado" });
        }
        const is_admin = await prisma_1.default.user_workspace.findFirst({
            where: {
                userId: userId,
                projectId: projectId,
                role: 'master',
            },
        });
        if (!is_admin) {
            return res.status(403).json({ message: "Apenas administradores podem adicionar membros" });
        }
        const user = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { id: (0, uuid_1.validate)(username) ? username : undefined },
                    { username },
                    { email: username }
                ]
            },
        });
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const existingMember = await prisma_1.default.user_workspace.findFirst({
            where: {
                userId: user.id,
                projectId: projectId,
            },
        });
        if (existingMember) {
            return res.status(400).json({ message: "Usuário já é membro do projeto" });
        }
        const newMember = await prisma_1.default.user_workspace.create({
            data: {
                userId: user.id,
                projectId: projectId,
                role: role || 'member',
            },
        });
        res.status(200).json({ message: "Membro adicionado com sucesso" });
    }
    catch (error) {
        res.status(500).json({ message: "Erro ao adicionar membro", error: error.message });
    }
};
exports.addMember = addMember;
const removeMember = async (req, res) => {
    const { username, projectId } = req.body;
    const userId = req.userId;
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    try {
        const existUserLogado = await prisma_1.default.user.findUnique({
            where: { id: userId }
        });
        if (!existUserLogado) {
            return res.status(401).json({ message: "Não autorizado" });
        }
        const is_admin = await prisma_1.default.user_workspace.findFirst({
            where: {
                userId: userId,
                projectId: projectId,
                role: 'master',
            },
        });
        if (!is_admin) {
            return res.status(403).json({ message: "Apenas administradores podem remover membros" });
        }
        const user = await prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { id: (0, uuid_1.validate)(username) ? username : undefined },
                    { username },
                    { email: username }
                ]
            },
        });
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const existingMember = await prisma_1.default.user_workspace.findFirst({
            where: {
                userId: user.id,
                projectId: projectId,
            },
        });
        if (!existingMember) {
            return res.status(400).json({ message: "Usuário não é membro do projeto" });
        }
        await prisma_1.default.user_workspace.delete({
            where: { id: existingMember.id },
        });
        res.status(200).json({ message: "Membro removido com sucesso" });
    }
    catch (error) {
        res.status(500).json({ message: "Erro ao remover membro", error: error.message });
    }
};
exports.removeMember = removeMember;
