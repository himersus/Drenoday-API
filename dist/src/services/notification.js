"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNotification = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const createNotification = async (userId, title, message) => {
    try {
        if (!userId) {
            const AdminUsers = await prisma_1.default.user.findMany({
                where: {
                    roleUser: 'admin'
                }
            });
            await Promise.all([
                AdminUsers.map(async (admin) => {
                    await prisma_1.default.notification.create({
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
        await prisma_1.default.notification.create({
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
