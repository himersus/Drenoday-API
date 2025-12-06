import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// funcao que gera nomes aleatorios (a implementar futuramente)
// ele coloca uma consonante, vogal, consoante, vogal para formar nomes tipo "balu", "nemo", "lilo", etc, com no maxio 5 letras
const generateRandomNames = () => {
    const consonants = "bcdfghjklmnpqrstvwxyz";
    const vowels = "aeiou";
    let name = "";
    for (let i = 0; i < 5; i++) {
        if (i % 2 === 0) {
            name += consonants.charAt(Math.floor(Math.random() * consonants.length));
        } else {
            name += vowels.charAt(Math.floor(Math.random() * vowels.length));
        }
    }
    return name;
}

export const generateUniqueDomain = async (name: string) => {
    if (!name) return null;
    const letName = name.toLowerCase();

    if (! await domainExists(letName)) 
        return letName;

    let uniqueDomain = letName;
    let counter = 1;

    while (counter <= 10) {
        uniqueDomain = `${letName}-${generateRandomNames()}`;
        if (! await domainExists(uniqueDomain)) {
            return uniqueDomain;
        }
        if (counter > 10) {
            uniqueDomain = `${letName}-${Math.floor(Math.random() * 1000)  }`;
            break;
        }
        counter++;
    }
    return uniqueDomain;
};



async function domainExists(domain: string): Promise<boolean> {

    const project = await prisma.project.findFirst({
        where: { domain },
    });
    return !!project;
}