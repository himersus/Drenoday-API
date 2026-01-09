import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createNotification = async (userId: string | null, title: string, message: string) => {
    try {
        if (!userId) {
            const AdminUsers = await prisma.user.findMany({
                where: {
                    roleUser: 'admin'
                }
            })
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
                }
                )
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
    } catch (error) {
        console.error("Error creating notification:", error);
    }
}