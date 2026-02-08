"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeploy = exports.listDeploys = void 0;
const uuid_1 = require("uuid");
const client_1 = require("@prisma/client");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma = new client_1.PrismaClient();
const listDeploys = async (req, res) => {
    const projectId = req.params.projectId;
    const userId = req.userId;
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma.user.findUnique({
        where: { id: userId }
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const exitProject = await prisma.project.findUnique({
        where: { id: projectId }
    });
    if (!exitProject) {
        return res.status(404).json({ message: "Projeto não encontrado" });
    }
    const userWorkspace = await prisma.user_workspace.findFirst({
        where: {
            userId,
            workspaceId: exitProject.workspaceId,
        }
    });
    /*if (!userWorkspace) {
        return res.status(403).json({ message: "Você não tem acesso a este projeto" });
    }*/
    try {
        const deploys = await prisma.deploy.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(deploys);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to list deploys" });
    }
};
exports.listDeploys = listDeploys;
const getDeploy = async (req, res) => {
    const deployId = req.params.deployId;
    const userId = req.userId;
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma.user.findUnique({
        where: { id: userId }
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const exitDeploy = await prisma.deploy.findUnique({
        where: { id: deployId }
    });
    if (!exitDeploy) {
        return res.status(404).json({ message: "Deploy não encontrado" });
    }
    const exitProject = await prisma.project.findUnique({
        where: { id: exitDeploy.projectId }
    });
    if (!exitProject) {
        return res.status(404).json({ message: "Projeto não encontrado" });
    }
    const userWorkspace = await prisma.user_workspace.findFirst({
        where: {
            userId,
            workspaceId: exitProject.workspaceId,
        }
    });
    if (!userWorkspace) {
        return res.status(403).json({ message: "Você não tem acesso a este deploy" });
    }
    try {
        res.status(200).json(exitDeploy);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to get deploy" });
    }
};
exports.getDeploy = getDeploy;
