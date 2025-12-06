
import dotenv from "dotenv";
dotenv.config();
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { generateUniqueUsername } from "../modify/username";
import { validate } from "uuid";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
export const createUser = async (req: Request, res: Response) => {
    const { email, name, password } = req.body;
    const username = await generateUniqueUsername(name);
    if (!username || !name) {
        return res.status(400).json({
            message: "O nome fornecido não é válido para gerar um nome de usuário."
        });
    }

    try {
        const user = await prisma.user.create({
            data: {
                email,
                name,
                password : await bcrypt.hash(password, 10),
                username: username as string,
            }
        });
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ message: "Failed to create user" });
    }
};

export const getUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
     
        const user = await prisma.user.findFirst({
            where: { 
               OR: [
                { id: validate(id) ? id : undefined },
                { username: id },
                { email: id }
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

export const updateUser = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email, name } = req.body;

    const existUser = await prisma.user.findFirst({
        where: { 
              OR: [
                { id: validate(id) ? id : undefined },
                { username: id },
                { email: id }
               ]
        },
    });

    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    try {
        const user = await prisma.user.update({
            where: { id },
            data: {
                email : email || existUser.email,
                name : name || existUser.name
            }
        });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: "Failed to update user" });
    }
};
