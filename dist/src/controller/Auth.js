"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginGoogle = exports.loginGitHub = exports.loginWithEmail = exports.verifyCode = exports.sendCodeVerification = exports.login = void 0;
require("dotenv/config");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const sendemail_1 = require("../middleware/sendemail");
const crypto_js_1 = __importDefault(require("crypto-js"));
const username_1 = require("../modify/username");
const prisma = new client_1.PrismaClient();
const login = async (req, res) => {
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
        const isValidPassword = await bcrypt_1.default.compare(password, hash_password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Usuário ou senha inválida" });
        }
        const payload = { id: user.id, is_active: user.is_active, username: user.username, email: user.email, provider: user.provider };
        const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET);
        res.status(200).json({ token });
    }
    catch (error) {
        return res.status(500).json({
            message: "O login falhou",
            error: error.message
        });
    }
};
exports.login = login;
const sendCodeVerification = async (req, res) => {
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
        await (0, sendemail_1.sendEmail)(email, "Código de Verificação - Drenoday", "Código de Verificação", verificationCode, `Seu código de verificação é: <strong>${verificationCode}</strong>.`);
        await prisma.user.update({
            where: { email },
            data: {
                confirme_code: await bcrypt_1.default.hash(verificationCode, 10)
            },
        });
        res.status(200).json({
            message: "Código de verificação enviado para o e-mail."
        });
    }
    catch (error) {
        return res.status(500).json({ message: "Falha ao enviar o código de verificação." });
    }
};
exports.sendCodeVerification = sendCodeVerification;
const verifyCode = async (req, res) => {
    const { email, code } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const isCodeValid = await bcrypt_1.default.compare(code, user.confirme_code || "");
        if (!isCodeValid) {
            return res.status(400).json({ message: "Código de verificação inválido" });
        }
        await prisma.user.update({
            where: { email },
            data: { is_active: true, confirme_code: null },
        });
        res.status(200).json({ message: "E-mail verificado com sucesso." });
    }
    catch (error) {
        return res.status(500).json({ message: "Falha ao verificar o código." });
    }
};
exports.verifyCode = verifyCode;
const loginWithEmail = async (req, res) => {
    const { email, code } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const isCodeValid = await bcrypt_1.default.compare(code, user.confirme_code || "");
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
        const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET);
        res.status(200).json({ token });
    }
    catch (error) {
        return res.status(500).json({ message: "Falha ao verificar o código." });
    }
};
exports.loginWithEmail = loginWithEmail;
const loginGitHub = async (req, res) => {
    const user = req.user;
    const token = req.user.token;
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
        let possibleUsername = await (0, username_1.generateUniqueUsername)(github_username, true);
        existUserDB = await prisma.user.create({
            data: {
                name: github_username,
                username: possibleUsername || github_username + Math.floor(1000 + Math.random() * 9000).toString(),
                email,
                provider: "github",
                password: null,
                is_active: true,
                github_username,
                github_token: crypto_js_1.default.AES.encrypt(github_token, process.env.GITHUB_TOKEN_ENCRYPTION_KEY).toString(),
                github_id: github_user_id
            }
        });
    }
    if (!existUserDB) {
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error?message=Usuário não encontrado. Por favor, registre-se primeiro.`);
    }
    const encryptedToken = crypto_js_1.default.AES.encrypt(github_token, process.env.GITHUB_TOKEN_ENCRYPTION_KEY).toString();
    try {
        await prisma.user.update({
            where: { id: existUserDB.id },
            data: {
                github_username,
                github_token: encryptedToken,
                github_id: github_user_id
            }
        });
    }
    catch (error) {
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
    const tokenUser = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET);
    // cookies
    res.cookie("auth_token", tokenUser, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 dia
    });
    res.cookie("github_token", encryptedToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 dia
    });
    res.cookie("github_username", github_username, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 dia
    });
    res.cookie("github_user_id", github_user_id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000, // 1 dia
    });
    return res.redirect(`${process.env.FRONTEND_URL}/auth/github?token=${tokenUser}&github_token=${encryptedToken}&github_username=${github_username}&github_user_id=${github_user_id}`);
};
exports.loginGitHub = loginGitHub;
const loginGoogle = async (req, res) => {
    const user = req.user;
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
        let possibleUsername = await (0, username_1.generateUniqueUsername)(name);
        const newUser = await prisma.user.create({
            data: {
                name,
                username: possibleUsername || email.split('@')[0] + Math.floor(1000 + Math.random() * 9000).toString(),
                email,
                provider: "google",
                password: Math.random().toString(36).slice(-8),
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
    const token = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET);
    return res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
};
exports.loginGoogle = loginGoogle;
