"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProject = runProject;
const child_process_1 = require("child_process");
const prisma_1 = __importDefault(require("../lib/prisma"));
const sockets_1 = require("../sockets");
const logs_1 = require("../utils/logs");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const github_1 = require("../utils/github");
const crypt_1 = require("../utils/crypt");
const generateEnvContent = (projectEnvs) => {
    let envContent = "";
    projectEnvs.forEach((envVar) => {
        envContent += `${envVar}\n`;
    });
    return envContent;
};
async function runProject(projectId, userId) {
    const project = await prisma_1.default.project.findFirst({
        where: { id: projectId },
    });
    if (!project) {
        return { statusCode: 404, message: "Projeto não encontrado" };
    }
    const now = new Date();
    if (!project.date_expire || project.date_expire < now) {
        return {
            statusCode: 403,
            message: "O plano associado a este projeto expirou. Por favor, renove o plano para continuar.",
        };
    }
    const existUser = await prisma_1.default.user.findFirst({
        where: { id: userId },
    });
    if (!existUser) {
        return { statusCode: 404, message: "Usuário não encontrado" };
    }
    if (project.userId !== userId) {
        return {
            statusCode: 403,
            message: "Você não tem permissão para executar este projeto",
        };
    }
    if (!existUser.github_token) {
        return {
            statusCode: 400,
            message: "Token do GitHub não encontrado, tente sincronizar novamente",
        };
    }
    /*if (project.clone !== 'cloned') {
              return res.status(400).json({ message: "O repositório ainda não foi clonado completamente" });
    }*/
    const deployDir = process.env.DEPLOY_DIR;
    const targetPath = `${deployDir}/${existUser.username}/${project.subdomain}`;
    if (!project.path) {
        await prisma_1.default.project.update({
            where: { id: project.id },
            data: { path: (0, crypt_1.encryptEnv)(targetPath) },
        });
    }
    const createComposeTreakfik = `
services:
  ${project.subdomain}:
    build: .
    container_name: ${project.subdomain}-api
    restart: always
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${project.subdomain}.rule=Host(\`${project.subdomain}.enor.tech\`)"
      - "traefik.http.routers.${project.subdomain}.entrypoints=websecure"
      - "traefik.http.routers.${project.subdomain}.tls.certresolver=le"
      - "traefik.http.services.${project.subdomain}.loadbalancer.server.port=${project.port}"
    networks:
      - web
networks:
  web:
    external: true
`;
    // garantir diretório
    fs_1.default.mkdirSync(targetPath, { recursive: true });
    // criar docker-compose
    fs_1.default.writeFileSync(path_1.default.join(targetPath, "docker-compose.yml"), createComposeTreakfik);
    const lastCommit = await (0, github_1.getLastCommitFromBranch)(project.repo_url, project.branch, existUser.github_token);
    const buildDeploy = await prisma_1.default.deploy.create({
        data: {
            projectId: projectId,
            commit_id: lastCommit.sha || "unknown",
            commit_msg: lastCommit.message || "unknown",
            commit_author: lastCommit.author || "unknown",
            commit_email: lastCommit.email || "unknown",
            commit_date: lastCommit.date || new Date(),
            commit_branch: project.branch,
            commit_avatar_url: lastCommit.avatar_url || null,
        },
    });
    (0, sockets_1.sendSocketContent)("deploy_logs", {
        deployId: buildDeploy.id,
        projectId: projectId,
        status: "building",
        message: "Iniciando build do deploy",
    });
    // verificar se existeo dockerfile no targetPath para continuar
    if (!fs_1.default.existsSync(path_1.default.join(targetPath, "Dockerfile"))) {
        await prisma_1.default.deploy.update({
            where: { id: buildDeploy.id },
            data: {
                status: "failed",
                success: false,
            },
        });
        (0, sockets_1.sendSocketContent)("deploy_logs", {
            deployId: buildDeploy.id,
            projectId: projectId,
            status: "failed",
            message: "Este projecto não está disponível para deploy, verifique se o Dockerfile existe na raiz do repositório",
        });
        return {
            statusCode: 404,
            message: "Este projecto não está disponível para deploy, verifique se o Dockerfile existe na raiz do repositório",
        };
    }
    const environments = await prisma_1.default.environment.findMany({
        where: { projectId: projectId },
    });
    // criar a varialeis de ambiente
    if (environments) {
        const envContent = generateEnvContent(environments.map((env) => `${env.key}=${(0, crypt_1.decryptEnv)(env.value)}`));
        fs_1.default.writeFileSync(path_1.default.join(targetPath, ".env"), envContent);
    }
    // subir container
    (0, child_process_1.exec)("git pull && docker-compose down -v && docker-compose up -d --build", { cwd: targetPath }, async (error, stdout, stderr) => {
        if (error) {
            console.error("[docker error]", stderr);
            const logSplit = stderr.split("\n");
            await prisma_1.default.deploy.update({
                where: { id: buildDeploy.id },
                data: {
                    status: "failed",
                    success: false,
                    logs: logSplit,
                },
            });
            (0, sockets_1.sendSocketContent)("deploy_logs", {
                deployId: buildDeploy.id,
                projectId: projectId,
                status: "failed",
                message: logSplit[logSplit.length - 2] ||
                    "Erro desconhecido durante o build do deploy",
            });
            await prisma_1.default.project.update({
                where: { id: projectId },
                data: { run_status: false },
            });
            return;
        }
        console.log("[docker]", stdout);
        const logSplit = stdout.split("\n");
        (0, sockets_1.sendSocketContent)("deploy_logs", {
            deployId: buildDeploy.id,
            projectId: projectId,
            status: "building",
            message: logSplit[logSplit.length - 2] || "Build do deploy concluído",
        });
        (0, logs_1.collectLogs)(buildDeploy.id, projectId, logSplit);
        await prisma_1.default.deploy.update({
            where: { id: buildDeploy.id },
            data: {
                status: "running",
                success: true,
            },
        });
        await prisma_1.default.project.update({
            where: { id: projectId },
            data: {
                run_status: true,
            },
        });
        (0, sockets_1.sendSocketContent)("deploy_logs", {
            deployId: buildDeploy.id,
            projectId: projectId,
            status: "running",
            message: "Deploy executando com sucesso",
        });
        (0, logs_1.startLogStream)(buildDeploy.id, projectId, project.subdomain);
    });
    return { statusCode: 200, message: "Deploy iniciado" };
}
