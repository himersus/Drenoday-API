"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPlanExpiryJob = void 0;
// src/jobs/planExpiry.job.ts
const node_cron_1 = __importDefault(require("node-cron"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const crypt_1 = require("../utils/crypt");
const sendemail_1 = require("../middleware/sendemail");
const stopExpiredProjects = async () => {
    console.log("[cron] A verificar planos expirados...");
    try {
        const userMap = new Map();
        // Busca projetos cujo plano expirou e ainda estão rodando
        const expiredProjects = await prisma_1.default.project.findMany({
            where: {
                run_status: true,
                date_expire: {
                    lt: new Date(),
                },
            },
            select: {
                id: true,
                subdomain: true,
                path: true, // caminho do docker-compose
                date_expire: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });
        if (expiredProjects.length === 0) {
            console.log("[cron] Nenhum projeto expirado encontrado.");
            return;
        }
        console.log(`[cron] ${expiredProjects.length} projeto(s) expirado(s) encontrado(s).`);
        for (const p of expiredProjects) {
            const existing = userMap.get(p.user.id);
            if (existing) {
                existing.projects.push(p);
            }
            else {
                userMap.set(p.user.id, {
                    user: p.user,
                    projects: [p],
                });
            }
        }
        // Para cada projeto expirado
        await Promise.allSettled(expiredProjects.map(async (project) => {
            const targetPath = path_1.default.resolve((0, crypt_1.decryptEnv)(project.path));
            return new Promise((resolve) => {
                (0, child_process_1.exec)("docker-compose down --rmi all", { cwd: targetPath }, async (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[cron error] ${project.subdomain}: ${stderr}`);
                        resolve();
                        return;
                    }
                    await prisma_1.default.project.update({
                        where: { id: project.id },
                        data: { run_status: false },
                    });
                    await prisma_1.default.notification.create({
                        data: {
                            userId: project.user.id,
                            title: "Plano Expirado",
                            message: `O plano do seu projeto '${project.subdomain}' expirou e ele foi parado. Entre em contato para renovar ou atualizar seu plano.`,
                            type: "warning",
                        },
                    });
                    await (0, sendemail_1.sendEmailWhenPlanExpires)(project.user.email, project.user.name, "Plano Expirado - Projeto Parado", `Olá ${project.user.name},\n\nO plano do seu projeto '${project.subdomain}' expirou e ele foi parado automaticamente. Para continuar usando nossos serviços, por favor, renove ou atualize seu plano.\n\nAtenciosamente,\nEquipe DrenoDay`);
                    console.log(`[cron] Projeto '${project.subdomain}' parado por expiração de plano.`);
                    resolve();
                });
            });
        }));
    }
    catch (error) {
        console.error("[cron] Erro ao verificar planos expirados:", error);
    }
};
const warnExpiringProjects = async () => {
    console.log("[cron] A verificar planos a expirar em breve...");
    try {
        const now = new Date();
        const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const expiringProjects = await prisma_1.default.project.findMany({
            where: {
                run_status: true,
                date_expire: {
                    gte: now, // ainda não expirou
                    lte: in3Days // mas expira nos próximos 3 dias
                },
            },
            select: {
                id: true,
                subdomain: true,
                path: true,
                date_expire: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });
        if (expiringProjects.length === 0) {
            console.log("[cron] Nenhum plano a expirar em breve.");
            return;
        }
        console.log(`[cron] ${expiringProjects.length} projeto(s) a expirar em breve.`);
        // Agrupa por utilizador para evitar N+1 de notificações
        const userMap = new Map();
        for (const project of expiringProjects) {
            const existing = userMap.get(project.user.id);
            if (existing) {
                existing.projects.push(project);
            }
            else {
                userMap.set(project.user.id, { user: project.user, projects: [project] });
            }
        }
        await Promise.allSettled(Array.from(userMap.values()).map(async ({ user, projects }) => {
            // Uma notificação por projeto
            await Promise.allSettled(projects.map(async (project) => {
                const daysLeft = Math.ceil((new Date(project.date_expire).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                // Evita notificação duplicada — verifica se já foi notificado hoje
                const alreadyNotified = await prisma_1.default.notification.findFirst({
                    where: {
                        userId: user.id,
                        title: "Aviso de Expiração",
                        createdAt: { gte: new Date(now.setHours(0, 0, 0, 0)) },
                        message: { contains: project.subdomain },
                    },
                });
                if (alreadyNotified) {
                    console.log(`[cron] Utilizador '${user.name}' já foi notificado hoje para '${project.subdomain}'.`);
                    return;
                }
                await prisma_1.default.notification.create({
                    data: {
                        userId: user.id,
                        title: "Aviso de Expiração",
                        message: `O plano do seu projeto '${project.subdomain}' expira em ${daysLeft} dia(s). Renove para evitar a interrupção do serviço.`,
                        type: "info",
                    },
                });
                await (0, sendemail_1.sendEmailWhenPlanExpires)(user.email, user.name, `Aviso: Plano expira em ${daysLeft} dia(s)`, `Olá ${user.name},\n\nO plano do seu projeto '${project.subdomain}' expira em ${daysLeft} dia(s).\n\nRenove agora para evitar a interrupção automática do seu serviço.\n\nAtenciosamente,\nEquipe DrenoDay`);
                console.log(`[cron] Aviso enviado para '${user.name}' — projeto '${project.subdomain}' expira em ${daysLeft} dia(s).`);
            }));
        }));
    }
    catch (error) {
        console.error("[cron] Erro ao verificar planos a expirar:", error);
    }
};
const startPlanExpiryJob = () => {
    // Verifica planos expirados a cada hora
    node_cron_1.default.schedule("0 * * * *", stopExpiredProjects, {
        timezone: "Africa/Luanda",
    });
    // Avisa planos a expirar todos os dias às 09:00
    node_cron_1.default.schedule("0 9 * * *", warnExpiringProjects, {
        timezone: "Africa/Luanda",
    });
    console.log("[cron] Jobs de expiração de planos iniciados.");
};
exports.startPlanExpiryJob = startPlanExpiryJob;
