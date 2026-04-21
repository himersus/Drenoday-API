import { Request, Response } from "express";
import { validate } from "uuid";
import prisma  from "../lib/prisma";

export const addMember = async (req: Request | any, res: Response) => {
    const { username, projectId, role } = req.body;
    const userId = req.userId;

    if (!userId || !validate(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    if (role && !['member', 'master'].includes(role)) {
        return res.status(400).json({ message: "Função inválida fornecida" });
    }

    try {
        const existUserLogado = await prisma.user.findFirst({
            where: { id: userId }
        });

        if (!existUserLogado) {
            return res.status(401).json({ message: "Não autorizado" });
        }

        const is_admin = await prisma.user_workspace.findFirst({
            where: {
                userId: userId,
                projectId: projectId,
                role: 'master',
            },
        });

        if (!is_admin) {
            return res.status(403).json({ message: "Apenas administradores podem adicionar membros" });
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: validate(username) ? username : undefined },
                    { username },
                    { email: username }
                ]
            },
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const existingMember = await prisma.user_workspace.findFirst({
            where: {
                userId: user.id,
                projectId: projectId,
            },
        });

        if (existingMember) {
            return res.status(400).json({ message: "Usuário já é membro do projeto" });
        }

        const newMember = await prisma.user_workspace.create({
            data: {
                userId: user.id,
                projectId: projectId,
                role: role || 'member',
            },
        });

        res.status(200).json({ message: "Membro adicionado com sucesso" });
    } catch (error: any) {
        res.status(500).json({ message: "Erro ao adicionar membro", error: error.message });
    }
};

export const removeMember = async (req: Request | any, res: Response) => {
    const { username, projectId } = req.body;

    const userId = req.userId;

    if (!userId || !validate(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    try {
        const existUserLogado = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existUserLogado) {
            return res.status(401).json({ message: "Não autorizado" });
        }

        const is_admin = await prisma.user_workspace.findFirst({
            where: {
                userId: userId,
                projectId: projectId,
                role: 'master',
            },
        });

        if (!is_admin) {
            return res.status(403).json({ message: "Apenas administradores podem remover membros" });
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: validate(username) ? username : undefined },
                    { username },
                    { email: username }
                ]
            },
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const existingMember = await prisma.user_workspace.findFirst({
            where: {
                userId: user.id,
                projectId: projectId,
            },
        });

        if (!existingMember) {
            return res.status(400).json({ message: "Usuário não é membro do projeto" });
        }

        await prisma.user_workspace.delete({
            where: { id: existingMember.id },
        });

        res.status(200).json({ message: "Membro removido com sucesso" });
    } catch (error: any) {
        res.status(500).json({ message: "Erro ao remover membro", error: error.message });
    }
};
