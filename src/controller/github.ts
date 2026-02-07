
import axios from "axios";
import { Request, Response } from "express";
import CryptoJS from 'crypto-js';
import { validate } from "uuid";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();

export const getUserRepos = async (req: Request | any, res: Response) => {
    const userId = req.userId;
    const page = req.params.page || 1;
    const limit = req.params.limit || 10;
    const offset = (limit * page) - limit;
    const name = req.query.name || "";


    try {

        if (!userId || !validate(userId)) {
            return res.status(401).json({ message: "Usuário não autenticado" });
        }

        const existUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const encrypted = existUser.github_token;

        if (!encrypted) {
            return res.status(404).json({ message: "Token do GitHub não encontrado, faça login com o github" });
        }

        const bytes = CryptoJS.AES.decrypt(encrypted, process.env.GITHUB_TOKEN_ENCRYPTION_KEY!);
        const token = bytes.toString(CryptoJS.enc.Utf8);

        if (!token) {
            return res.status(401).json({ message: "Token não fornecido" });
        }

        const response = await axios.get("https://api.github.com/user/repos",
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/vnd.github+json"
                },
                params: {
                    affiliation: "owner,collaborator,organization_member",
                    sort: "updated",
                    direction: "desc",
                    page,
                    per_page: limit
                }
            }
        );

        if (response.status !== 200) {
            return res.status(response.status).json({ message: "Erro ao buscar repositórios" });
        }

        if (name) {
            response.data = response.data.filter((repo: any) =>
                repo.name.toLowerCase().includes((name as string).toLowerCase())
            );
        }

        return res.json(response.data);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Erro ao buscar repositórios",
            error: error instanceof Error ? error.message : "Erro desconhecido"
        });
    }
};

export const syncUserWithGitHub = async (req: Request | any, res: Response) => {
    const userId = req.userId;
    const { github_username, github_token, github_user_id } = req.body;

    try {
        if (!github_username || !github_token || !github_user_id) {
            return res.status(400).json({ message: "Dados do GitHub não fornecidos" });
        }
        if (!userId || !validate(userId)) {
            return res.status(401).json({ message: "Usuário não autenticado" });
        }
        const existUser = await prisma.user.findFirst({
            where: { id: userId }
        });

        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const encryptedToken = CryptoJS.AES.encrypt(github_token, process.env.GITHUB_TOKEN_ENCRYPTION_KEY!).toString();


        await prisma.user.update({
            where: { id: userId },
            data: {
                github_username,
                github_token: encryptedToken,
                github_id: github_user_id
            }
        });

        return res.status(200).json({ message: "Sincronização com GitHub realizada com sucesso" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao sincronizar com GitHub" });
    }
};

export const unsyncUserFromGitHub = async (req: Request | any, res: Response) => {
    const userId = req.userId;

    if (!userId || !validate(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const existUser = await prisma.user.findFirst({
        where: { id: userId }
    });

    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }

    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                github_username: null,
                github_token: null,
                github_id: null
            }
        });

        return res.status(200).json({ message: "Desconexão do GitHub realizada com sucesso" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao desconectar do GitHub" });
    }
};

export const createCookieGitHub = (req: any, res: any) => {
    res.cookie('teste', "TEsteeeeee", {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 1 dia
    });
    return res.status(200).json({ message: "Cookie criado com sucesso" });
}

export const readCookieGitHub = (req: any, res: any) => {
    const teste = req.cookies['auth_token'];
    res.status(200).json({ cookie: teste });
}