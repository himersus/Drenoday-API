"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateWorkspace = exports.getWorkspace = exports.createWorkspace = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createWorkspace = async (req, res) => {
    const { name } = req.body;
    const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId
    try {
        const existUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: userId },
                    { username: userId },
                    { email: userId }
                ]
            },
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const existUserInWorkspace = await prisma.user_workspace.findFirst({
            where: {
                userId,
                workspaceId: {
                    in: (await prisma.workspace.findMany({
                        where: { name },
                        select: { id: true }
                    })).map(workspace => workspace.id)
                }
            }
        });
        if (existUserInWorkspace) {
            return res.status(400).json({ error: "Você já está no workspace com este nome" });
        }
        const workspace = await prisma.workspace.create({
            data: {
                name
            }
        });
        res.status(201).json(workspace);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create workspace" });
    }
};
exports.createWorkspace = createWorkspace;
const getWorkspace = async (req, res) => {
    const { id } = req.params;
    try {
        const workspace = await prisma.workspace.findUnique({
            where: { id },
        });
        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }
        res.status(200).json(workspace);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to retrieve workspace" });
    }
};
exports.getWorkspace = getWorkspace;
const updateWorkspace = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        const workspace = await prisma.workspace.update({
            where: { id },
            data: {
                name
            }
        });
        res.status(200).json(workspace);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update workspace" });
    }
};
exports.updateWorkspace = updateWorkspace;
