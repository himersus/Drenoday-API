import { Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { validate } from "uuid";
import { generateUniqueDomain } from "../modify/domain";


const prisma = new PrismaClient();

export const createProject = async (req: Request | any, res: Response) => {
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

        const domain = await generateUniqueDomain(name);

        if (!domain) {
            return res.status(500).json({ message: "Não foi possível gerar um domínio único" });
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
        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({ error: "Failed to create project" });
    }
};