import e, { Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";
import { validate } from "uuid";


const prisma = new PrismaClient();

export const createWorkspace = async (req: Request | any, res: Response) => {
    const { name } = req.body;
    const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId

    try {
        if (!name) {
            return res.status(400).json({ message: "O nome do workspace é obrigatório" });
        }
        if (!validate(userId)) {
            return res.status(400).json({ message: "O ID do usuário não pode ser um UUID" });
        }
        const existUser = await prisma.user.findFirst({
            where: {
                id: userId,
            },
        });

        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const existUserInWorkspace = await prisma.workspace.findFirst({
            where: {
                name: name,
            }
        });

        if (existUserInWorkspace) {
            const workspaceUsers = await prisma.user_workspace.findFirst({
                where: {
                    userId: existUser.id,
                    workspaceId: existUserInWorkspace ? existUserInWorkspace.id : undefined,
                }
            });
            if (workspaceUsers) {
                return res.status(400).json({ error: "Você já está no workspace com este nome" });
            }
        }

        const workspace = await prisma.workspace.create({
            data: {
                name,
            }
        });

        const userWorkspace = await prisma.user_workspace.create({
            data: {
                userId: existUser.id,
                workspaceId: workspace.id,
                role: "master",
            }
        });
        res.status(201).json({ ...workspace, username: existUser.username });
    } catch (error) {
        res.status(500).json({ error: "Failed to create workspace" });
    }
};

export const getWorkspace = async (req: Request | any, res: Response) => {
    const { workspaceId } = req.params;
    const userId = req.userId;

    if (!validate(workspaceId) || !validate(userId)) {
        return res.status(400).json({ message: "Invalid workspace ID" });
    }

    const existUser = await prisma.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const existUserInWorkspace = await prisma.user_workspace.findFirst({
        where: {
            userId: userId,
            workspaceId: workspaceId,
        }
    });

    if (!existUserInWorkspace) {
        return res.status(403).json({ message: "Você não tem permissão para acessar este workspace" });
    }
    try {
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
        });

        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }
        const totalProjects = await prisma.project.count({
            where: {
                workspaceId: workspaceId
            }
        });

        const totalMembers = await prisma.user_workspace.count({
            where: {
                workspaceId: workspaceId
            }
        });
        res.status(200).json({ ...workspace, username: existUser.username, totalProjects, totalMembers });
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve workspace" });
    }
};

export const getAllWorkspaces = async (req: Request | any, res: Response) => {
    const userId = req.userId;
    try {
        const existUser = await prisma.user.findFirst({
            where: {
                id: userId,
            },
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const workspaces = await prisma.user_workspace.findMany({
            where: {
                userId: userId
            }
        });

        const workspaceIds = workspaces.map((uw) => uw.workspaceId);
        const allWorkspaces = await prisma.workspace.findMany({
            where: {
                id: {
                    in: workspaceIds
                }
            }
        });

        const workspacesWithUsernames = await Promise.all(allWorkspaces.map(async (workspace) => {
            const totalProjects = await prisma.project.count({
                where: {
                    workspaceId: workspace.id
                }
            });
            const totalMembers = await prisma.user_workspace.count({
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
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve workspaces" });
    }
}

export const updateWorkspace = async (req: Request | any, res: Response) => {
    const { workspaceId } = req.params;
    const userId = req.userId;
    const { name } = req.body;

    if (!validate(workspaceId) || !validate(userId)) {
        return res.status(400).json({ message: "Invalid workspace ID" });
    }

    const existUser = await prisma.user.findFirst({
        where: {
            id: userId,
        },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const existUserInWorkspace = await prisma.user_workspace.findFirst({
        where: {
            userId: userId,
            workspaceId: workspaceId,
        }
    });

    if (!existUserInWorkspace) {
        return res.status(403).json({ message: "Você não tem permissão para atualizar este workspace" });
    }

    try {
        const existWorkspace = await prisma.workspace.findFirst({
            where: {
                NOT: [{ id: workspaceId }],
                name: name
            },
        });

        if (existWorkspace) {
            return res.status(400).json({ message: "Já existe um workspace com este nome" });
        }

        const workspace = await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
                name
            }
        });
        res.status(200).json({ ...workspace, username: existUser.username });
    } catch (error) {
        res.status(500).json({ message: "Failed to update workspace" });
    }
};

export const deleteWorkspace = async (req: Request | any, res: Response) => {
    const { workspaceId } = req.params;
    const userId = req.userId;

    try {
        const userWorkspace = await prisma.user_workspace.findFirst({
            where: {
                userId: userId,
                workspaceId: workspaceId
            }
        });

        if (!userWorkspace) {
            return res.status(403).json({ message: "Você não tem permissão para deletar este workspace" });
        }

        await prisma.user_workspace.deleteMany({
            where: { workspaceId: workspaceId },
        });
        await prisma.workspace.delete({
            where: { id: workspaceId },
        });

        res.status(200).json({ message: "Workspace deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete workspace" });
    }
};
