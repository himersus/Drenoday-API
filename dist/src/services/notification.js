"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const createNotification = async (userId, title, message) => {
    try {
        if (!userId) {
            const AdminUsers = await prisma.user.findMany({
                where: {
                    roleUser: 'admin'
                }
            });
            await Promise.all([
                AdminUsers.map(async (admin) => {
                    await prisma.notification.create({
                        data: {
                            userId: admin.id,
                            title: title,
                            message: message,
                            read: false,
                        },
                    });
                })
            ]);
            return;
        }
        await prisma.notification.create({
            data: {
                userId: userId,
                title: title,
                message: message,
                read: false,
            },
        });
        console.log("Notification created successfully");
    }
    catch (error) {
        console.error("Error creating notification:", error);
    }
};
exports.createNotification = createNotification;
