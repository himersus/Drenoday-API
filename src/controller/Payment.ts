import { Request, Response } from "express";
import { validate } from "uuid";
import { PrismaClient } from "@prisma/client";
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