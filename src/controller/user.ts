
import { Request, Response } from "express";
import { generateUniqueUsername } from "../modify/username";
import { validate } from "uuid";
import bcrypt from "bcrypt";
import { q } from "../helper/to_string";

import prisma  from "../lib/prisma";

export const createUser = async (req: Request, res: Response) => {
    const { email, name, password } = req.body;


    if (!email || !name || !password) {
        return res.status(400).json({ message: "Email, nome e senha são obrigatórios" });
    }
    const username = await generateUniqueUsername(name);
    if (!username || !name) {
        return res.status(400).json({
            message: "O nome fornecido não é válido para gerar um nome de usuário."
        });
    }

    try {
        const existUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { username }
                ]
            },
        });

        if (existUser) {
            return res.status(400).json({ message: "Usuário com este email ou username já existe." });
        }

        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: await bcrypt.hash(password, 10),
                username: username as string,
            }
        });
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ message: "Failed to create user" });
    }
};

export const getUser = async (req: Request, res: Response) => {
    const  userId  = q(req.params.userId);
    try {

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: validate(userId) ? userId : undefined },
                    { username: userId },
                    { email: userId }
                ]
            },
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve user" });
    }
};

export const getAllUsers = async (req: Request, res: Response) => {
    const { username } = req.query;

    if (username && typeof username !== 'string') {
        return res.status(400).json({ message: "Username inválido" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    try {
        const users = await prisma.user.findMany({
            where: {
                username: {
                    contains: username ? username as string : undefined,
                    mode: "insensitive"
                },
            },
            skip,
            take: limit,
            orderBy: {
                createdAt: 'desc'
            }
        });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve users" });
    }
}

export const UserLoged = async (req: Request | any, res: Response) => {
    const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve logged-in user" });
    }
};

export const updateUser = async (req: Request | any, res: Response) => {
    const userId = req.userId;
    const { email, name } = req.body;

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

    try {
        const user = await prisma.user.update({
            where: { id: existUser.id },
            data: {
                email: email || existUser.email,
                name: name || existUser.name
            }
        });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: "Failed to update user" });
    }
};
