import { Request, Response } from "express";
import { validate } from "uuid";
import { PaymentStatus, PrismaClient, statusSolicitation, typePayment } from "@prisma/client";
import { sendSocketContent } from "../sockets";
import axios from "axios";
import dotenv from "dotenv";
import { randomUUID } from 'crypto';


const token = "123";
dotenv.config();

const prisma = new PrismaClient();

const generateReferenceNumber = (): string => {
    // numero de 9 digitos mas nao pode começar com 9 nem 0
    let number = '';
    const firstDigit = Math.floor(Math.random() * 8) + 1; // Gera um número entre 1 e 8
    number += firstDigit.toString();

    for (let i = 1; i < 9; i++) {
        const digit = Math.floor(Math.random() * 10); // Gera um número entre 0 e 9
        number += digit.toString();
    }
    return `${number}`;
};

export const getAllReferences = async (req: Request, res: Response) => {
    try {
        const options = {
            method: 'GET',
            url: 'https://gwy-api.appypay.co.ao/v2.0/references',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`
            }
        };

        const response = await axios.request(options);

        return res.status(200).json(response.data);
    } catch (error: any) {
        console.error(error.response?.data || error);

        return res.status(500).json({
            message: 'Erro ao obter referências de pagamento',
            error: error.response?.data || error.message,
        });
    }
};


export const referenceSendPaymentGateway = async (req: Request, res: Response) => {
    try {
        const { amount, description } = req.body;

        const now = new Date().toISOString();
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + 7);
        const expirationDateStr = expiration.toISOString();

        const ref = generateReferenceNumber();
        console.log('Generated Reference Number:', ref);

        const options = {
            method: 'POST',
            url: 'https://gwy-api.appypay.co.ao/v2.0/references',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${token}`
            },
            data: {
                paymentMethod: process.env.PG_PAYMENT_METHOD_ID,
                references: [
                    {
                        //referenceNumber: ref,
                        currency: 'AOA',
                        amounts: [
                            { amount: amount, descriptionLine1: description },
                        ],
                        minAmount: 10,
                        maxAmount: 20,
                        startDate: now,
                        expirationDate: expirationDateStr
                    }
                ],
                createdBy: 'DrenoDaySystem',
            }
        };

        const response = await axios.request(options);

        return res.status(200).json(response.data);
    } catch (error: any) {
        console.error(error.response?.data || error);

        return res.status(500).json({
            message: 'Erro ao criar referência de pagamento',
            error: error.response?.data || error.message,
        });
    }
};




export const getAppyPayToken = async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.PG_API_CLIENT_ID!);
    params.append('client_secret', process.env.PG_API_SECRET!);
    params.append('resource', 'bee57785-7a19-4f1c-9c8d-aa03f2f0e333');

    const response = await axios.post(
      `https://login.microsoftonline.com/auth.appypay.co.ao/oauth2/token`,
      params,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    return res.status(200).json(response.data);

  } catch (error: any) {
    console.error(error.response?.data || error);
    return res.status(500).json({
      message: 'Erro ao obter token AppyPay',
      error: error.response?.data || error.message,
    });
  }
};





export const confirmPayment = async (req: Request | any, res: Response) => {
    const userId = req.userId;
    const { paymentId, status } = req.body;

    if (!userId || !validate(userId)) {
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

    } else if (payment_form === 'yearly') {
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
    }
    else {
        return res.status(400).json({
            message: "Forma de pagamento inválida"
        });
    }
    const project = await prisma.project.updateMany({
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

        sendSocketContent("confirmed_payment", {
            userId: userId,
            paymentId: paymentId,
            status: status == 'completed' ? 'Pago' : 'Rejeitado',
        });

        return res.status(201).json( payment );
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao registrar pagamento" });
    }
}

export const createPayment = async (req: Request | any, res: Response) => {
    const userId = req.userId;
    const { projectId, plan_name, proof_payment } = req.body;

    if (validate(!projectId)) {
        return res.status(400).json({ message: "ID do projeto inválido" });
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
    } else if (existPlan.duration === 365) {
        payment_form = 'yearly';
    } else {
        payment_form = 'daily';
    }

    const payment_form_str = payment_form as typePayment || 'monthly';

    if (payment_form_str !== 'monthly' && payment_form_str !== 'yearly' && payment_form_str !== 'daily') {
        return res.status(400).json({ message: "Forma de pagamento inválida" });
    }

    let amount = existPlan.price;
    let time_in_day: number | undefined = undefined;
    if (payment_form_str === 'yearly') {
        amount = existPlan.price * 12 - (existPlan.price * 0.5);
        time_in_day = existPlan.duration * 12;
    } else if (payment_form_str === 'daily') {
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
                userId: existUser.id, // ID do usuário que realizou o pagamento
                planId: existPlan.id, // ID do plano escolhido
                plan_name: existPlan.name, // nome do plano escolhido
                amount: amount, // valor do pagamento
                proof_payment: proof_payment, // comprovante de pagamento
                time_in_day: time_in_day || 0, // tempo em dias do pagamento
                status: 'pending', // status do pagamento
                type_payment: payment_form_str, // tipo de pagamento
                qty_months: 1, // quantidade de meses
                projectId: existProject.id // ID do projeto associado ao pagamento
            }
        });
        sendSocketContent("new_payment", {
            userId: userId,
            paymentId: payment.id,
            amount: amount,
            plan_name: existPlan.name,
            status: 'Pendente',
        });

        return res.status(201).json(payment);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao registrar pagamento" });
    }
};

export const getUserPayments = async (req: Request | any, res: Response) => {
    const userId = req.userId;
    const status = req.query.status as string | undefined;

    if (status && (status !== 'pending' && status !== 'completed' && status !== 'failed')) {
        return res.status(400).json({ message: "Status de pagamento inválido" });
    }

    if (!userId || !validate(userId)) {
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
                status: status ? status as PaymentStatus : undefined
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

export const getPaymentById = async (req: Request | any, res: Response) => {
    const userId = req.userId;
    const { paymentId } = req.params;

    if (!userId || !validate(userId)) {
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

        return res.status(200).json( payment );
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar pagamento" });
    }
};