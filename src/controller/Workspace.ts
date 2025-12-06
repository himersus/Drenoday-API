import { Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();

export const createWorkspace = async (req: Request | any, res: Response) => {
    const { name} = req.body;
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
    } catch (error) {
        res.status(500).json({ error: "Failed to create workspace" });
    }
};

export const getWorkspace = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const workspace = await prisma.workspace.findUnique({
            where: { id },
        });

        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }
        res.status(200).json(workspace);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve workspace" });
    }
};

export const updateWorkspace = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name} = req.body;



    try {
        const workspace = await prisma.workspace.update({
            where: { id },
            data: {
                name
            }
        });
        res.status(200).json(workspace);
    } catch (error) {
        res.status(500).json({ error: "Failed to update workspace" });
    }
};