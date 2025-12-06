
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const createUser = async (req: Request, res: Response) => {
    const { email, name, password } = req.body;
    const username = await generateUniqueUsername(name);

    try {
        const user = await prisma.user.create({
            data: {
                email,
                name,
                password,
                username: email.split('@')[0],
            }
        });
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: "Failed to create user" });
    }
};
