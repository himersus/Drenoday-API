import {PrismaClient} from "@prisma/client";

const prisma = new PrismaClient();

export const createNotification = async (userId: string | null, title: string, message: string) => {
    try {
        await prisma.notification.create({
            data: {
                userId: userId || undefined,
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