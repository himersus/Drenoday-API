"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOneNotification = exports.markNotificationAsRead = exports.myNotifications = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const uuid_1 = require("uuid");
const to_string_1 = require("../helper/to_string");
const myNotifications = async (req, res) => {
    const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId
    if (!(0, uuid_1.validate)(userId)) {
        return res.status(400).json({ message: "ID do usuário inválido" });
    }
    try {
        const existUser = await prisma_1.default.user.findFirst({
            where: { id: userId }
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        if (existUser.roleUser == "admin") {
            const notifications = await prisma_1.default.notification.findMany({
                where: {
                    OR: [
                        { userId: null },
                        { userId: userId },
                    ]
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            return res.status(200).json(notifications);
        }
        const notifications = await prisma_1.default.notification.findMany({
            where: {
                userId: userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return res.status(200).json(notifications);
    }
    catch (error) {
        console.error("Error fetching notifications:", error);
        return res.status(500).json([]);
    }
};
exports.myNotifications = myNotifications;
const markNotificationAsRead = async (req, res) => {
    const { notificationId } = (0, to_string_1.q)(req.params);
    const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId
    if (!(0, uuid_1.validate)(notificationId)) {
        return res.status(400).json({ message: "ID da notificação inválido" });
    }
    try {
        const existUser = await prisma_1.default.user.findFirst({
            where: { id: userId }
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const notification = await prisma_1.default.notification.findFirst({
            where: { id: notificationId }
        });
        if (!notification) {
            return res.status(404).json({ message: "Notificação não encontrada" });
        }
        if (existUser.roleUser !== "admin" && notification.userId !== userId) {
            return res.status(403).json({ message: "Você não tem permissão para marcar esta notificação como lida" });
        }
        await prisma_1.default.notification.update({
            where: { id: notificationId },
            data: { read: true }
        });
        return res.status(200).json({ message: "Notificação marcada como lida" });
    }
    catch (error) {
        console.error("Error marking notification as read:", error);
        return res.status(500).json({ message: "Erro ao marcar notificação como lida" });
    }
};
exports.markNotificationAsRead = markNotificationAsRead;
const getOneNotification = async (req, res) => {
    const { notificationId } = (0, to_string_1.q)(req.params);
    const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId
    if (!(0, uuid_1.validate)(notificationId)) {
        return res.status(400).json({ message: "ID da notificação inválido" });
    }
    try {
        const existUser = await prisma_1.default.user.findFirst({
            where: { id: userId }
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const notification = await prisma_1.default.notification.findFirst({
            where: { id: notificationId }
        });
        if (!notification) {
            return res.status(404).json({ message: "Notificação não encontrada" });
        }
        if (existUser.roleUser !== "admin" && notification.userId !== userId) {
            return res.status(403).json({ message: "Você não tem permissão para ver esta notificação" });
        }
        return res.status(200).json(notification);
    }
    catch (error) {
        console.error("Error fetching notification:", error);
        return res.status(500).json({ message: "Erro ao buscar notificação" });
    }
};
exports.getOneNotification = getOneNotification;
