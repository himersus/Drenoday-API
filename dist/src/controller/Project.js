"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProject = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client_1 = require("@prisma/client");
const domain_1 = require("../generator/domain");
const prisma = new client_1.PrismaClient();
const createProject = async (req, res) => {
    const { name, description, environments, workspaceId } = req.body;
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
        if (!name) {
            return res.status(400).json({ message: "O nome do projeto é obrigatório" });
        }
        const domain = await (0, domain_1.generateUniqueDomain)(name);
        if (!domain) {
            return res.status(500).json({ message: "Não foi possível gerar um domínio único" });
        }
        const project = await prisma.project.create({
            data: {
                name,
                description,
                workspaceId,
                userId: existUser.id,
                domain: domain,
                environments: environments || [],
            }
        });
        res.status(201).json(project);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create project" });
    }
};
exports.createProject = createProject;
