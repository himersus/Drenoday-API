import { Request, Response } from "express";
import { validate } from "uuid";
import { q } from "../utils/to_string";


import prisma  from "../lib/prisma";

export const listDeploys = async (req: Request | any, res: Response) => {
    const projectId = q(req.params.projectId) as string;
    const userId = req.userId;

    if (!userId || !validate(userId)) {
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

    /*const userWorkspace = await prisma.user_workspace.findFirst({
        where: {
            userId,
            workspaceId: exitProject.workspaceId,
        }
    });*/

    /*if (!userWorkspace) {
        return res.status(403).json({ message: "Você não tem acesso a este projeto" });
    }*/

    try {
        const deploys = await prisma.deploy.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(deploys);
    } catch (error) {
        res.status(500).json({ message: "Failed to list deploys" });
    }
};

export const getDeploy = async (req: Request | any, res: Response) => {
    const deployId = q(req.params.deployId);
    const userId = req.userId;
    const page = parseInt(q(req.query.page) || "1");
    const per_page = parseInt(q(req.query.per_page) || "10");
    if (!userId || !validate(userId)) {
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
            projectId: exitProject.id,
        }
    });

    if (!userWorkspace) {
        return res.status(403).json({ message: "Você não tem acesso a este deploy" });
    }

    try {

        const count_deploys = await prisma.deploy.count({
            where: { projectId: exitProject.id }
        });
        const totalPages = Math.ceil(count_deploys / per_page);
        
        res.status(200).json({
            data : exitDeploy,
            pagination: {
                page,
                per_page,
                total_pages: totalPages,
                total : count_deploys
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to get deploy" });
    }
};