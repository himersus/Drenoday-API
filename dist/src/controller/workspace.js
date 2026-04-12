"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteWorkspace = exports.updateWorkspace = exports.getAllWorkspaces = exports.getWorkspace = exports.createWorkspace = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const uuid_1 = require("uuid");
const to_string_1 = require("../helper/to_string");
const prisma_1 = __importDefault(require("../lib/prisma"));
const createWorkspace = async (req, res) => {
    const { name } = req.body;
    const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId
    try {
        if (!name) {
            return res.status(400).json({ message: "O nome do workspace é obrigatório" });
        }
        if (!(0, uuid_1.validate)(userId)) {
            return res.status(400).json({ message: "O ID do usuário não pode ser um UUID" });
        }
        const existUser = await prisma_1.default.user.findFirst({
            where: {
                id: userId,
            },
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const existUserInWorkspace = await prisma_1.default.workspace.findFirst({
            where: {
                name: name,
            }
        });
        if (existUserInWorkspace) {
            const workspaceUsers = await prisma_1.default.user_workspace.findFirst({
                where: {
                    userId: existUser.id,
                    workspaceId: existUserInWorkspace ? existUserInWorkspace.id : undefined,
                }
            });
            if (workspaceUsers) {
                return res.status(400).json({ error: "Você já está no workspace com este nome" });
            }
        }
        const workspace = await prisma_1.default.workspace.create({
            data: {
                name,
            }
        });
        const userWorkspace = await prisma_1.default.user_workspace.create({
            data: {
                userId: existUser.id,
                workspaceId: workspace.id,
                role: "master",
            }
        });
        res.status(201).json({ ...workspace, username: existUser.username, totalProjects: 0, totalMembers: 1 });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create workspace" });
    }
};
exports.createWorkspace = createWorkspace;
const getWorkspace = async (req, res) => {
    const workspaceId = (0, to_string_1.q)(req.params.workspaceId);
    const userId = req.userId;
    if (!(0, uuid_1.validate)(workspaceId) || !(0, uuid_1.validate)(userId)) {
        return res.status(400).json({ message: "Invalid workspace ID" });
    }
    const existUser = await prisma_1.default.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const existUserInWorkspace = await prisma_1.default.user_workspace.findFirst({
        where: {
            userId: userId,
            workspaceId: workspaceId,
        }
    });
    if (!existUserInWorkspace) {
        return res.status(403).json({ message: "Você não tem permissão para acessar este workspace" });
    }
    try {
        const workspace = await prisma_1.default.workspace.findUnique({
            where: { id: workspaceId },
        });
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }
        const totalProjects = await prisma_1.default.project.count({
            where: {
                workspaceId: workspaceId
            }
        });
        const totalMembers = await prisma_1.default.user_workspace.count({
            where: {
                workspaceId: workspaceId
            }
        });
        res.status(200).json({ ...workspace, username: existUser.username, totalProjects, totalMembers });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to retrieve workspace" });
    }
};
exports.getWorkspace = getWorkspace;
const getAllWorkspaces = async (req, res) => {
    const userId = req.userId;
    try {
        const existUser = await prisma_1.default.user.findFirst({
            where: {
                id: userId,
            },
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const workspaces = await prisma_1.default.user_workspace.findMany({
            where: {
                userId: userId
            }
        });
        const workspaceIds = workspaces.map((uw) => uw.workspaceId);
        const allWorkspaces = await prisma_1.default.workspace.findMany({
            where: {
                id: {
                    in: workspaceIds
                }
            }
        });
        const workspacesWithUsernames = await Promise.all(allWorkspaces.map(async (workspace) => {
            const totalProjects = await prisma_1.default.project.count({
                where: {
                    workspaceId: workspace.id
                }
            });
            const totalMembers = await prisma_1.default.user_workspace.count({
                where: {
                    workspaceId: workspace.id
                }
            });
            return {
                ...workspace,
                username: existUser.username,
                totalProjects,
                totalMembers
            };
        }));
        res.status(200).json(workspacesWithUsernames);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to retrieve workspaces" });
    }
};
exports.getAllWorkspaces = getAllWorkspaces;
const updateWorkspace = async (req, res) => {
    const workspaceId = (0, to_string_1.q)(req.params.workspaceId);
    const userId = req.userId;
    const { name } = req.body;
    if (!(0, uuid_1.validate)(workspaceId) || !(0, uuid_1.validate)(userId)) {
        return res.status(400).json({ message: "Invalid workspace ID" });
    }
    const existUser = await prisma_1.default.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const existUserInWorkspace = await prisma_1.default.user_workspace.findFirst({
        where: {
            userId: userId,
            workspaceId: workspaceId,
        }
    });
    if (!existUserInWorkspace) {
        return res.status(403).json({ message: "Você não tem permissão para atualizar este workspace" });
    }
    try {
        const existWorkspace = await prisma_1.default.workspace.findFirst({
            where: {
                NOT: [{ id: workspaceId }],
                name: name
            },
        });
        if (existWorkspace) {
            return res.status(400).json({ message: "Já existe um workspace com este nome" });
        }
        const workspace = await prisma_1.default.workspace.update({
            where: { id: workspaceId },
            data: {
                name
            }
        });
        const totalMembers = await prisma_1.default.user_workspace.count({
            where: {
                workspaceId: workspaceId
            }
        });
        const totalProjects = await prisma_1.default.project.count({
            where: {
                workspaceId: workspaceId
            }
        });
        res.status(200).json({ ...workspace, username: existUser.username, totalProjects, totalMembers });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to update workspace" });
    }
};
exports.updateWorkspace = updateWorkspace;
const deleteWorkspace = async (req, res) => {
    const workspaceId = (0, to_string_1.q)(req.params.workspaceId);
    const userId = req.userId;
    try {
        const userWorkspace = await prisma_1.default.user_workspace.findFirst({
            where: {
                userId: userId,
                workspaceId: workspaceId
            }
        });
        if (!userWorkspace) {
            return res.status(403).json({ message: "Você não tem permissão para deletar este workspace" });
        }
        await prisma_1.default.user_workspace.deleteMany({
            where: { workspaceId: workspaceId },
        });
        await prisma_1.default.workspace.delete({
            where: { id: workspaceId },
        });
        res.status(200).json({ message: "Workspace deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to delete workspace" });
    }
};
exports.deleteWorkspace = deleteWorkspace;
