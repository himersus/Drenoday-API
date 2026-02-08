"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProject = void 0;
const child_process_1 = require("child_process");
const client_1 = require("@prisma/client");
const sockets_1 = require("../sockets");
const logs_1 = require("../helper/logs");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const github_1 = require("../helper/github");
const prisma = new client_1.PrismaClient();
const generateEnvContent = (projectEnvs) => {
    let envContent = "";
    projectEnvs.forEach((envVar) => {
        envContent += `${envVar}\n`;
    });
    return envContent;
};
async function runProject(projectId, userId) {
    const project = await prisma.project.findFirst({
        where: { id: projectId },
    });
    if (!project) {
        return { statusCode: 404, message: "Projeto não encontrado" };
    }
    const now = new Date();
    if (!project.date_expire || project.date_expire < now) {
        return { statusCode: 403, message: "O plano associado a este projeto expirou. Por favor, renove o plano para continuar." };
    }
    const existUser = await prisma.user.findFirst({
        where: { id: userId },
    });
    if (!existUser) {
        return { statusCode: 404, message: "Usuário não encontrado" };
    }
    if (project.userId !== userId) {
        return { statusCode: 403, message: "Você não tem permissão para executar este projeto" };
    }
    if (!existUser.github_token) {
        return { statusCode: 400, message: "Token do GitHub não encontrado, tente sincronizar novamente" };
    }
    /*if (project.clone !== 'cloned') {
        return res.status(400).json({ message: "O repositório ainda não foi clonado completamente" });
    }*/
    const deployDir = process.env.DEPLOY_DIR;
    const targetPath = `${deployDir}/${existUser.username}/${project.domain}`;
    const createComposeTreakfik = `
services:
  ${project.domain}:
    build: .
    container_name: ${project.domain}
    restart: always
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${project.domain}.rule=Host(\`${project.domain}.enor.tech\`)"
      - "traefik.http.routers.${project.domain}.entrypoints=websecure"
      - "traefik.http.routers.${project.domain}.tls.certresolver=myresolver"
      - "traefik.http.services.${project.domain}.loadbalancer.server.port=${project.port}"
    networks:
      - traefik-network
networks:
  traefik-network:
    external: true
`;
    // garantir diretório
    fs_1.default.mkdirSync(targetPath, { recursive: true });
    // criar docker-compose
    fs_1.default.writeFileSync(path_1.default.join(targetPath, "docker-compose.yml"), createComposeTreakfik);
    const lastCommit = await (0, github_1.getLastCommitFromBranch)(project.repo_url, project.branch, existUser.github_token);
    const buildDeploy = await prisma.deploy.create({
        data: {
            projectId: projectId,
            commit_id: lastCommit.sha || "unknown",
            commit_msg: lastCommit.message || "unknown",
            commit_author: lastCommit.author || "unknown",
            commit_email: lastCommit.email || "unknown",
            commit_date: lastCommit.date || new Date()
        }
    });
    (0, sockets_1.sendSocketContent)("deploy_logs", {
        deployId: buildDeploy.id,
        projectId: projectId,
        status: "building",
        message: "Iniciando build do deploy"
    });
    // verificar se existeo dockerfile no targetPath para continuar
    if (!fs_1.default.existsSync(path_1.default.join(targetPath, "Dockerfile"))) {
        await prisma.deploy.update({
            where: { id: buildDeploy.id },
            data: {
                status: "failed",
                success: false
            }
        });
        (0, sockets_1.sendSocketContent)("deploy_logs", {
            deployId: buildDeploy.id,
            projectId: projectId,
            status: "failed",
            message: "Este projecto não está disponível para deploy, verifique se o Dockerfile existe na raiz do repositório"
        });
        return { statusCode: 404, message: "Este projecto não está disponível para deploy, verifique se o Dockerfile existe na raiz do repositório" };
    }
    // criar a varialeis de ambiente
    if (project.environments && project.environments.length > 0) {
        const envContent = generateEnvContent(project.environments);
        fs_1.default.writeFileSync(path_1.default.join(targetPath, ".env"), envContent);
    }
    // subir container
    (0, child_process_1.exec)("git pull && docker-compose down && docker-compose up -d --build", { cwd: targetPath }, async (error, stdout, stderr) => {
        if (error) {
            console.error("[docker error]", stderr);
            await prisma.deploy.update({
                where: { id: buildDeploy.id },
                data: {
                    status: "failed",
                    success: false
                }
            });
            (0, sockets_1.sendSocketContent)("deploy_logs", {
                deployId: buildDeploy.id,
                projectId: projectId,
                status: "failed",
                message: "Erro ao construir o deploy: " + stderr
            });
            return;
        }
        console.log("[docker]", stdout);
        const logSplit = stdout.split("\n");
        (0, sockets_1.sendSocketContent)("deploy_logs", {
            deployId: buildDeploy.id,
            projectId: projectId,
            status: "building",
            message: logSplit[logSplit.length - 2] || "Build do deploy concluído"
        });
        (0, logs_1.collectLogs)(buildDeploy.id, projectId, logSplit);
        await prisma.deploy.update({
            where: { id: buildDeploy.id },
            data: {
                status: "running",
                success: true
            }
        });
        (0, sockets_1.sendSocketContent)("deploy_logs", {
            deployId: buildDeploy.id,
            projectId: projectId,
            status: "running",
            message: "Deploy executando com sucesso"
        });
        (0, logs_1.startLogStream)(buildDeploy.id, projectId, project.domain);
    });
    return { statusCode: 200, message: "Deploy iniciado" };
}
exports.runProject = runProject;
