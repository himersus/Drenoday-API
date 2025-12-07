import { Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { validate } from "uuid";
import { generateUniqueDomain } from "../modify/domain";


const prisma = new PrismaClient();

export const createProject = async (req: Request | any, res: Response) => {
    const { name, description, environments, workspaceId, amount } = req.body;
    const userId = req.userId;
    try {
        const existUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: validate(userId) ? userId : undefined },
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

        const domain = await generateUniqueDomain(name);

        if (!domain) {
            return res.status(500).json({ message: "Não foi possível gerar um domínio único" });
        }

        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ message: "O valor do pagamento é inválido" });
        }

        const project = await prisma.project.create({
            data: {
                name,
                description,
                workspaceId,
                userId: existUser.id,
                domain: domain as string,
                environments: environments || [],
            }
        });

        const payment = await prisma.payment.create({
            data: {
                userId: existUser.id,
                amount: amount,
                status: 'pending',
                type_payment : 'monthly',
                qty_months : 1,
                projectId: project.id
            }
        });
        res.status(201).json({ ...project, payment });
    } catch (error) {
        res.status(500).json({ 
            message: "Failed to create project",
            error: (error as Error).message
         });
    }
};

export const getProject = async (req: Request, res: Response) => {
    const { projectId } = req.params;
    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            return res.status(404).json({ message: "Projeto não encontrado" });
        }
        res.status(200).json(project);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve project" });
    }
};

export const getMyProjects = async (req: Request | any, res: Response) => {
    const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId
    const workspaceId = req.params.workspaceId;
    try {
        const projects = await prisma.project.findMany({
            where: { userId, workspaceId },
        });

        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve projects" });
    }
};