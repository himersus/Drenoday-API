import 'dotenv/config';
import { Request, Response } from "express";
import { validate } from "uuid";
import bcrypt from "bcrypt";
import { generateUniqueDomain } from "../modify/domain";
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../middleware/sendemail";
import CryptoJS from 'crypto-js';


const prisma = new PrismaClient();


export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { username },
                    { email: username }
                ]
            }
        });

        if (!user) {
            return res.status(401).json({ message: "Usuário ou senha inválida" });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Usuário ou senha inválida" });
        }

        const payload = { id: user.id, is_active: user.is_active, username: user.username, email: user.email, provider: user.provider };

        const token = jwt.sign(payload, process.env.JWT_SECRET as string);

        res.status(200).json({ token });
    } catch (error: any) {
        return res.status(500).json({
            message: "O login falhou",
            error: error.message
        });
    }
};

export const sendCodeVerification = async (req: Request, res: Response) => {
    const { email } = req.body;

    try {
        const user = await prisma.user.findFirst({
            where: { email },
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        await prisma.user.update({
            where: { email },
            data: { confirme_code: verificationCode },
        });


        await sendEmail(
            email,
            "Código de Verificação - GoHost",
            "Código de Verificação",
            verificationCode,
            `Seu código de verificação é: <strong>${verificationCode}</strong>.`
        );

        await prisma.user.update({
            where: { email },
            data: {
                confirme_code: await bcrypt.hash(verificationCode, 10)
            },
        });
        res.status(200).json({
            message: "Código de verificação enviado para o e-mail."
        });
    } catch (error) {
        return res.status(500).json({ message: "Falha ao enviar o código de verificação." });
    }
}

export const verifyCode = async (req: Request, res: Response) => {
    const { email, code } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        const isCodeValid = await bcrypt.compare(code, user.confirme_code || "");
        if (!isCodeValid) {
            return res.status(400).json({ message: "Código de verificação inválido" });
        }

        await prisma.user.update({
            where: { email },
            data: { is_active: true, confirme_code: null },
        });

        res.status(200).json({ message: "E-mail verificado com sucesso." });
    } catch (error) {
        return res.status(500).json({ message: "Falha ao verificar o código." });
    }
}

export const loginGitHub = async (req: Request | any, res: Response) => {
    const user: any = req.user;
    const token = (req.user as any).token;


    if (!user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    return res.redirect(`${process.env.FRONTEND_URL}/github?token=${token}&username=${user.username}&id=${user.id}`);
};

export const loginGoogle = async (req: Request | any, res: Response) => {
    const user: any = req.user;
     const state = JSON.parse(req.query.state || '{}');
    const create = state.create || 'true';

    if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Usuário não encontrado. Por favor, registre-se primeiro.`);
    }

    // Dados vindos do Google
    const email = user.emails[0].value || user.email;
    const provider_id = user.id;
    const name = user.displayName || email.split('@')[0];

    let userInDb = await prisma.user.findFirst({
        where: { email },
    });

    if (!userInDb && create === 'false') {
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Usuário não encontrado. Por favor, registre-se primeiro.&create=${create}`);
    }

    if (!userInDb && create === 'true') {
        let possibleUsername = await generateUniqueDomain(name);

        const newUser = await prisma.user.create({
            data: {
                name,
                username: possibleUsername || email.split('@')[0] + Math.floor(1000 + Math.random() * 9000).toString(),
                email,
                provider: "google",
                password: Math.random().toString(36).slice(-8), // senha aleatória
                is_active: true,
            }
        });
        userInDb = newUser;
    }

    const payload = {
        id: userInDb?.id,
        is_active: userInDb?.is_active,
        username: userInDb?.username,
        email: userInDb?.email,
        provider: "google"
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET as string);
    return res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
};