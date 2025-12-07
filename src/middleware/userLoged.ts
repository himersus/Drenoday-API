import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const jwtSecret = process.env.JWT_SECRET as string;

export const verifyAuthentication = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({
            message: "Usuário não autenticado. Por favor, faça login."
        });
        return;
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, jwtSecret) as { id: string; username: string; email: string; role: string };
        (req as any).userId = decoded.id;
        (async () => {
            console.log("Verifying user with ID:", decoded.id);
            const user = await prisma.user.findFirst({
                where: {
                    id: decoded.id,
                },
            });
            if (!user) {
                res.status(401).json({
                    message: "Usuário não encontrado. Por favor, faça login novamente."
                });
                return;
            }
            if (user.is_active === false) {
                res.status(400).json({
                    message: "Conta inativa. Por favor, ative sua conta."
                });
                return;
            }
        })();
    } catch (error) {
        res.status(401).json({
            message: "Usuário não autenticado. Por favor, faça login."
        });
        return;
    }
    next();
};