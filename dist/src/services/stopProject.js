"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopProject = stopProject;
const child_process_1 = require("child_process");
const prisma_1 = __importDefault(require("../lib/prisma"));
async function stopProject(projectId, userId) {
    const project = await prisma_1.default.project.findFirst({
        where: { id: projectId },
    });
    if (!project) {
        return {
            statusCode: 404,
            message: "Projeto não encontrado",
        };
    }
    if (project.userId !== userId) {
        return {
            statusCode: 403,
            message: "Você não tem permissão para parar este projeto",
        };
    }
    const existUser = await prisma_1.default.user.findFirst({
        where: { id: userId },
    });
    if (!existUser) {
        return {
            statusCode: 404,
            message: "Usuário não encontrado",
        };
    }
    const deployDir = process.env.DEPLOY_DIR;
    const targetPath = `${deployDir}/${existUser.username}/${project.subdomain}`;
    (0, child_process_1.exec)("docker-compose down", { cwd: targetPath }, async (error, stdout, stderr) => {
        if (error) {
            console.error(`[docker error]: ${stderr}`);
            return;
        }
        console.log(`[docker]: ${stdout}`);
    });
    return {
        statusCode: 200,
        message: "Projeto parado com sucesso",
    };
}
