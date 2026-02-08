"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUniqueUsername = void 0;
require("dotenv/config");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function generateUniqueUsername(fullName, is_auth20 = false) {
    const names = fullName.trim().toLowerCase().split(/\s+/);
    const firstName = names[0];
    const lastName = names[names[1] ? names.length - 1 : -1];
    const randomNumber = Math.floor(Math.random() * 1000);
    if (!firstName)
        return null;
    if (!lastName)
        return `${firstName}${randomNumber}`;
    // Começa com a primeira letra do nome + sobrenome
    let baseUsername = `${firstName[0]}${lastName}`;
    let username = baseUsername;
    let counter = 1;
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
exports.generateUniqueUsername = generateUniqueUsername;
// Função que verifica se já existe
async function usernameExists(username) {
    const user = await prisma.user.findFirst({
        where: { username },
    });
    return !!user;
}
