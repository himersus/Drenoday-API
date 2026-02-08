import 'dotenv/config';
import { Request, Response } from "express";
import { validate } from "uuid";
import bcrypt from "bcrypt";
import { generateUniqueDomain } from "../modify/domain";
import jwt from "jsonwebtoken"
import { PrismaClient } from "@prisma/client";
import { sendEmail } from "../middleware/sendemail";
import CryptoJS from 'crypto-js';
import { generateUniqueUsername } from '../modify/username';


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

        const hash_password = user?.password || "";

        if (!user || !password) {
            return res.status(401).json({ message: "Usuário ou senha inválida" });
        }

        const isValidPassword = await bcrypt.compare(password, hash_password);
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
            "Código de Verificação - Drenoday",
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

export const loginWithEmail = async (req: Request, res: Response) => {
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

        const payload = {
            id: user.id,
            is_active: user.is_active,
            username: user.username,
            email: user.email,
            provider: user.provider
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET as string);

        res.status(200).json({ token});
    } catch (error) {
        return res.status(500).json({ message: "Falha ao verificar o código." });
    }
}

export const loginGitHub = async (req: Request | any, res: Response) => {
    const user: any = req.user;
    const token = (req.user as any).token;
    const email = user.email;
    const create = user.create || 'false';

    const github_token = token;
    const github_username = user.username;
    const github_user_id = user.id;

    if (!github_username || !github_token || !github_user_id) {
        return res.status(400).json({ message: "Dados do GitHub não fornecidos" });
    }

    if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Usuário não encontrado. Por favor, registre-se primeiro.`);
    }

    let existUserDB = await prisma.user.findFirst({
        where: { email },
    });

    if (!existUserDB && create === 'true') {
        let possibleUsername = await generateUniqueUsername(github_username, true);

        existUserDB = await prisma.user.create({
            data: {
                name: github_username,
                username: possibleUsername || github_username + Math.floor(1000 + Math.random() * 9000).toString(),
                email,
                provider: "github",
                password: null, // senha aleatória
                is_active: true,
                github_username,
                github_token: CryptoJS.AES.encrypt(github_token, process.env.GITHUB_TOKEN_ENCRYPTION_KEY!).toString(),
                github_id: github_user_id
            }
        });
    }

    if (!existUserDB) {
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Usuário não encontrado. Por favor, registre-se primeiro.`);
    }

    const encryptedToken = CryptoJS.AES.encrypt(github_token, process.env.GITHUB_TOKEN_ENCRYPTION_KEY!).toString();

    try {
        await prisma.user.update({
            where: { id: existUserDB.id },
            data: {
                github_username,
                github_token: encryptedToken,
                github_id: github_user_id
            }
        });

    } catch (error) {
        console.error(error);
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Erro ao sincronizar com GitHub`);
    }

    const payload = {
        id: existUserDB?.id,
        is_active: existUserDB?.is_active,
        username: existUserDB?.username,
        email: existUserDB?.email,
        provider: "github"
    };

    const tokenUser = jwt.sign(payload, process.env.JWT_SECRET as string);

    return res.redirect(`${process.env.FRONTEND_URL}/auth/github?token=${tokenUser}&github_token=${encryptedToken}&github_username=${github_username}&github_user_id=${github_user_id}`);
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
        let possibleUsername = await generateUniqueUsername(name);

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