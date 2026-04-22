"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUniqueSubdomain = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// funcao que gera nomes aleatorios (a implementar futuramente)
// ele coloca uma consonante, vogal, consoante, vogal para formar nomes tipo "balu", "nemo", "lilo", etc, com no maxio 5 letras
const generateRandomNames = () => {
    const consonants = "bcdfghjklmnpqrstvwxyz";
    const vowels = "aeiou";
    let name = "";
    for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
            name += consonants.charAt(Math.floor(Math.random() * consonants.length));
        }
        else {
            name += vowels.charAt(Math.floor(Math.random() * vowels.length));
        }
    }
    return name;
};
const generateUniqueSubdomain = async (name) => {
    if (!name)
        return null;
    const letName = name.toLowerCase();
    if (!await subDomainExists(letName))
        return letName;
    let uniqueDomain = letName;
    let counter = 1;
    while (counter <= 10) {
        uniqueDomain = `${letName}-${generateRandomNames()}`;
        if (!await subDomainExists(uniqueDomain)) {
            return uniqueDomain;
        }
        if (counter > 10) {
            uniqueDomain = `${letName}-${Math.floor(Math.random() * 1000)}`;
            break;
        }
        counter++;
    }
    return uniqueDomain;
};
exports.generateUniqueSubdomain = generateUniqueSubdomain;
async function subDomainExists(domain) {
    const project = await prisma_1.default.project.findFirst({
        where: { subdomain: domain },
    });
    return !!project;
}
