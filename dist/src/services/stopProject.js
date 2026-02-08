"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopProject = void 0;
const child_process_1 = require("child_process");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function stopProject(projectId, userId) {
    const project = await prisma.project.findFirst({
        where: { id: projectId },
    });
    if (!project) {
        return {
            statusCode: 404,
            message: "Projeto não encontrado"
        };
    }
    if (project.userId !== userId) {
        return {
            statusCode: 403,
            message: "Você não tem permissão para parar este projeto"
        };
    }
    const existUser = await prisma.user.findFirst({
        where: { id: userId },
    });
    if (!existUser) {
        return {
            statusCode: 404,
            message: "Usuário não encontrado"
        };
    }
    const deployDir = process.env.DEPLOY_DIR;
    const targetPath = `${deployDir}/${existUser.username}/${project.domain}`;
    (0, child_process_1.exec)("docker-compose down", { cwd: targetPath }, async (error, stdout, stderr) => {
        if (error) {
            console.error(`[docker error]: ${stderr}`);
            return;
        }
        console.log(`[docker]: ${stdout}`);
    });
    return {
        statusCode: 200,
        message: "Projeto parado com sucesso"
    };
}
exports.stopProject = stopProject;
