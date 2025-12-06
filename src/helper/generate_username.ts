import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config();


const prisma = new PrismaClient();

export async function generateUniqueUsername(fullName: string, is_auth20 : boolean = false): Promise<string | any> {
    const names = fullName.trim().toLowerCase().split(/\s+/);
    const firstName = names[0];
    const lastName = names[names[1] ? names.length - 1 : -1];

    if ((!firstName || !lastName) && !is_auth20)
        return null;
    const randomNumber = Math.floor(Math.random() * 1000);
    if (!firstName && !lastName && is_auth20)
        return `${randomNumber}`;
    if (firstName && !lastName)
        return `${firstName}-${randomNumber}`;
    // Começa com a primeira letra do nome + sobrenome
    let baseUsername = `${firstName[0]}${lastName}`;
    let username = baseUsername;
    let counter = 1;

    // gerar numeros aletorios para o username

    // Verifica se já existe esse username
    while (counter < 10) {
        if (counter === 1) {
            username = baseUsername;
        }
        if (counter > 1 && firstName.length - 1 > counter) {
            username = `${firstName.slice(0, counter)}-${lastName}`;
        }
        else if (counter > 1 && lastName.length - 1 > counter) {
            username = `${firstName}-${lastName.slice(0, counter)}`;
        }
        const userExists = await usernameExists(username);
        if (!userExists)
            return username;
        counter++;
    }
    username = `${baseUsername}-${randomNumber}`;
}

// Função que verifica se já existe
async function usernameExists(username: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { username },
    });
    return !!user;
}