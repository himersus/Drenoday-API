"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentById = exports.getUserPayments = exports.createPayment = exports.confirmPayment = exports.webhookPayment = exports.getAppyPayToken = exports.referenceSendPaymentGateway = void 0;
const uuid_1 = require("uuid");
const client_1 = require("@prisma/client");
const sockets_1 = require("../sockets");
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const Payment_1 = require("../services/Payment");
const notification_1 = require("../services/notification");
const prisma = new client_1.PrismaClient();
dotenv_1.default.config();
const generateMerchantId = () => {
    // no maximo 15 digitos, deve conter pelomenos um caracter e todos devem ser alfanumericos
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let merchantId = '';
    for (let i = 0; i < 15; i++) {
        merchantId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return merchantId;
};
const referenceSendPaymentGateway = async (req, res) => {
    try {
        const { description, projectId, plan_name } = req.body;
        const userId = req.userId;
        const verifyPayRaw = await (0, Payment_1.verificationPayment)(userId, projectId, plan_name);
        if (verifyPayRaw.code != 200) {
            return res.status(verifyPayRaw.code || 400).json({
                message: verifyPayRaw.message
            });
        }
        const verifyPay = verifyPayRaw.data;
        const merchantId = generateMerchantId();
        // valor real deve ser o: verifyPay.amount
        const data = await (0, Payment_1.referenceSendPaymentService)(merchantId, 1, description);
        if (data.code != 200) {
            return res.status(data.code || 400).json({
                message: data.message || "Erro ao criar referência de pagamento",
                /*error: data.error || {
                    message: "Erro desconhecido ao criar referência de pagamento"
                }*/
            });
        }
        const createPayment = await prisma.payment.create({
            data: {
                userId: userId,
                planId: verifyPay.plan_id,
                plan_name: verifyPay.plan_name,
                amount: 0,
                time_in_day: verifyPay.time_in_day || 0,
                entity: data.data.entity,
                ref: data.data.referenceNumber,
                merchant: merchantId,
                status: 'pending',
                type_payment: verifyPay.type_payment,
                qty_months: 1,
                projectId: projectId // ID do projeto associado ao pagamento
            }
        });
        (0, sockets_1.sendSocketContent)("new_payment", {
            userId: userId,
            paymentId: createPayment.id,
            amount: verifyPay.amount,
            plan_name: verifyPay.plan_name,
            status: 'pending',
        });
        return res.status(200).json(data);
    }
    catch (error) {
        console.error(error.response?.data || error);
        return res.status(500).json({
            message: 'Erro ao criar referência de pagamento',
            error: error.response?.data || error.message,
        });
    }
};
exports.referenceSendPaymentGateway = referenceSendPaymentGateway;
const getAppyPayToken = async (req, res) => {
    try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', process.env.PG_API_CLIENT_ID);
        params.append('client_secret', process.env.PG_API_SECRET);
        params.append('resource', process.env.PG_RESOURCE_ID);
        const response = await axios_1.default.post(`https://login.microsoftonline.com/auth.appypay.co.ao/oauth2/token`, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return res.status(200).json(response.data);
    }
    catch (error) {
        console.error(error.response?.data || error);
        return res.status(500).json({
            message: 'Erro ao obter token AppyPay',
            error: error.response?.data || error.message,
        });
    }
};
exports.getAppyPayToken = getAppyPayToken;
const webhookPayment = async (req, res) => {
    const payload = req.body;
    if (!payload) {
        await (0, notification_1.createNotification)(null, "Webhook Error", "Payload inválido");
        return res.status(400).json({ message: "Payload inválido" });
    }
    const { merchantTransactionId, reference, responseStatus } = payload;
    if (!responseStatus) {
        await (0, notification_1.createNotification)(null, "Webhook Error", "Status ausente");
        return res.status(400).json({ message: "Status ausente" });
    }
    if (responseStatus.code !== 100) {
        return res.status(200).json({ received: true });
    }
    const referenceNumber = reference.referenceNumber;
    const existPayment = await prisma.payment.findFirst({
        where: {
            OR: [
                { merchant: merchantTransactionId },
                { ref: referenceNumber }
            ]
        }
    });
    if (!existPayment) {
        await (0, notification_1.createNotification)(null, "Falha no pagamento", "Pagamento não encontrado");
        return res.status(200).json({ received: true });
    }
    const userId = existPayment.userId;
    if (!userId || !(0, uuid_1.validate)(userId)) {
        await (0, notification_1.createNotification)(null, "Falha no pagamento", "Usuário do pagamento não autenticado para o webhook recebido.");
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma.user.findFirst({
        where: { id: userId }
    });
    if (!existUser) {
        await (0, notification_1.createNotification)(null, "Falha no pagamento", "Usuário do pagamento não encontrado para o webhook recebido.");
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    let payment_form = existPayment.type_payment;
    const currentDate = new Date();
    const dateStart = new Date(currentDate);
    const expirationDate = new Date(currentDate);
    if (payment_form === 'monthly') {
        expirationDate.setMonth(expirationDate.getMonth() + 1);
    }
    else if (payment_form === 'yearly') {
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    }
    else if (payment_form === 'daily') {
        expirationDate.setDate(expirationDate.getDate() + 1);
    }
    else {
        await (0, notification_1.createNotification)(userId, "Falha no pagamento", "Forma de pagamento inválida no webhook recebido.");
        return res.status(400).json({
            message: "Forma de pagamento inválida"
        });
    }
    await prisma.project.update({
        where: {
            id: existPayment.projectId
        },
        data: {
            date_expire: expirationDate
        }
    });
    await prisma.payment.update({
        where: { id: existPayment.id },
        data: {
            date_start: dateStart,
            date_end: expirationDate,
            status: "completed" // Atualiza o status do pagamento para o valor fornecido
        }
    });
    (0, sockets_1.sendSocketContent)("confirmed_payment", {
        userId: userId,
        paymentId: existPayment.id,
        status: "Pago",
        message: "Pagamento realizado com sucesso"
    });
    await (0, notification_1.createNotification)(existPayment.userId, "Sucesso", "Pagamento realizado com sucesso.");
    // Aqui você pode processar os dados recebidos no webhook conforme necessário
    res.status(200).json({ message: "Webhook recebido com sucesso" });
};
exports.webhookPayment = webhookPayment;
const confirmPayment = async (req, res) => {
    const userId = req.userId;
    const { paymentId, status } = req.body;
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma.user.findUnique({
        where: { id: userId }
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const existPayment = await prisma.payment.findUnique({
        where: { id: paymentId }
    });
    if (!existPayment) {
        return res.status(404).json({ message: "Pagamento não encontrado" });
    }
    let payment_form = existPayment.type_payment;
    const currentDate = new Date();
    const dateStart = new Date(currentDate);
    const expirationDate = new Date(currentDate);
    if (payment_form === 'monthly') {
        expirationDate.setMonth(expirationDate.getMonth() + 1);
    }
    else if (payment_form === 'yearly') {
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    }
    else {
        return res.status(400).json({
            message: "Forma de pagamento inválida"
        });
    }
    const project = await prisma.project.update({
        where: {
            id: existPayment.projectId
        },
        data: {
            date_expire: expirationDate
        }
    });
    try {
        const payment = await prisma.payment.update({
            where: { id: paymentId },
            data: {
                date_start: dateStart,
                date_end: expirationDate,
                status: status // Atualiza o status do pagamento para o valor fornecido
            }
        });
        (0, sockets_1.sendSocketContent)("confirmed_payment", {
            userId: userId,
            paymentId: paymentId,
            status: status == 'completed' ? 'Pago' : 'Rejeitado',
        });
        return res.status(201).json(payment);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao registrar pagamento" });
    }
};
exports.confirmPayment = confirmPayment;
const createPayment = async (req, res) => {
    const userId = req.userId;
    const { projectId, plan_name, proof_payment } = req.body;
    if ((0, uuid_1.validate)(!projectId)) {
        return res.status(400).json({ message: "ID do projeto inválido" });
    }
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma.user.findFirst({
        where: { id: userId }
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const existProject = await prisma.project.findFirst({
        where: { id: projectId }
    });
    if (!existProject) {
        return res.status(404).json({ message: "Projeto não encontrado" });
    }
    const existPlan = await prisma.plan.findFirst({
        where: { name: plan_name }
    });
    if (!existPlan) {
        return res.status(404).json({ message: "Plano não encontrado" });
    }
    if (!proof_payment || typeof proof_payment !== 'string') {
        return res.status(400).json({ message: "Comprovante de pagamento inválido" });
    }
    let payment_form = '';
    if (existPlan.duration === 30) {
        payment_form = 'monthly';
    }
    else if (existPlan.duration === 365) {
        payment_form = 'yearly';
    }
    else {
        payment_form = 'daily';
    }
    const payment_form_str = payment_form || 'monthly';
    if (payment_form_str !== 'monthly' && payment_form_str !== 'yearly' && payment_form_str !== 'daily') {
        return res.status(400).json({ message: "Forma de pagamento inválida" });
    }
    let amount = existPlan.price;
    let time_in_day = undefined;
    if (payment_form_str === 'yearly') {
        amount = existPlan.price * 12 - (existPlan.price * 0.5);
        time_in_day = existPlan.duration * 12;
    }
    else if (payment_form_str === 'daily') {
        amount = existPlan.price;
        time_in_day = existPlan.duration;
    }
    else {
        amount = existPlan.price;
        time_in_day = existPlan.duration;
    }
    try {
        const existPayment = await prisma.payment.findFirst({
            where: {
                proof_payment: proof_payment,
            }
        });
        if (existPayment) {
            return res.status(400).json({ message: "Já existe um pagamento com este comprovante" });
        }
        const payment = await prisma.payment.create({
            data: {
                userId: existUser.id,
                planId: existPlan.id,
                plan_name: existPlan.name,
                amount: amount,
                proof_payment: proof_payment,
                time_in_day: time_in_day || 0,
                status: 'pending',
                type_payment: payment_form_str,
                qty_months: 1,
                projectId: existProject.id // ID do projeto associado ao pagamento
            }
        });
        (0, sockets_1.sendSocketContent)("new_payment", {
            userId: userId,
            paymentId: payment.id,
            amount: amount,
            plan_name: existPlan.name,
            status: 'Pendente',
        });
        return res.status(201).json(payment);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao registrar pagamento" });
    }
};
exports.createPayment = createPayment;
const getUserPayments = async (req, res) => {
    const userId = req.userId;
    const status = req.query.status;
    if (status && (status !== 'pending' && status !== 'completed' && status !== 'failed')) {
        return res.status(400).json({ message: "Status de pagamento inválido" });
    }
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma.user.findUnique({
        where: { id: userId }
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    try {
        const payments = await prisma.payment.findMany({
            where: {
                userId: userId,
                status: status ? status : undefined
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return res.status(200).json(payments);
    }
    catch (error) {
        console.error(error);
        return res.status(400).json({ message: "Erro ao buscar pagamentos" });
    }
};
exports.getUserPayments = getUserPayments;
const getPaymentById = async (req, res) => {
    const userId = req.userId;
    const { paymentId } = req.params;
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma.user.findUnique({
        where: { id: userId }
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    try {
        const payment = await prisma.payment.findFirst({
            where: {
                id: paymentId,
                userId: userId
            }
        });
        if (!payment) {
            return res.status(404).json({ message: "Pagamento não encontrado" });
        }
        return res.status(200).json(payment);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar pagamento" });
    }
};
exports.getPaymentById = getPaymentById;
