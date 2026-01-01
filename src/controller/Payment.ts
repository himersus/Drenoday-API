import { Request, Response } from "express";
import { validate } from "uuid";
import { PrismaClient, typePayment } from "@prisma/client";
import { sendSocketContent } from "../sockets";

const prisma = new PrismaClient();

export const updatePayment = async (req: Request | any, res: Response) => {
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

        return res.status(201).json({ payment });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao registrar pagamento" });
    }
}

export const createPayment = async (req: Request | any, res: Response) => {
    const userId = req.userId;
    const { projectId, plan_name, payment_form, proof_payment } = req.body;

    if (!userId || !validate(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const existUser = await prisma.user.findUnique({
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

    const existPlan = await prisma.plan.findUnique({
        where: { name: plan_name }
    });


    if (!existPlan) {
        return res.status(404).json({ message: "Plano não encontrado" });
    }

    if (proof_payment && typeof proof_payment !== 'string') {
        return res.status(400).json({ message: "Comprovante de pagamento inválido" });
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
        const payment = await prisma.payment.create({
            data: {
                userId: existUser.id, // ID do usuário que realizou o pagamento
                planId: existPlan.id, // ID do plano escolhido
                plan_name: existPlan.name, // nome do plano escolhido
                amount: amount, // valor do pagamento
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

        return res.status(201).json({ payment });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao registrar pagamento" });
    }
};

export const getUserPayments = async (req: Request | any, res: Response) => {
    const userId = req.userId;

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
            where: { userId: userId },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return res.status(200).json({ payments });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar pagamentos" });
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

        return res.status(200).json({ payment });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar pagamento" });
    }
};