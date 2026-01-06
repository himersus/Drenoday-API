import { exec } from "child_process";
import { PrismaClient } from "@prisma/client";
import { sendSocketContent } from "../sockets";
import { collectLogs, startLogStream } from "../helper/logs";
import fs from "fs";
import path from "path";
import { getLastCommitFromBranch } from "../helper/github";

type RunProjectResponse = {
    statusCode: number;
    message: string;
} | void;

const prisma = new PrismaClient();

const generateEnvContent = (projectEnvs: string[]): string => {
    let envContent = "";
    projectEnvs.forEach((envVar: string) => {
        envContent += `${envVar}\n`;
    });
    return envContent;
}

export async function runProject(projectId: string, userId: string):  Promise<RunProjectResponse> {
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
        fs.mkdirSync(targetPath, { recursive: true });

        // criar docker-compose
        fs.writeFileSync(
            path.join(targetPath, "docker-compose.yml"),
            createComposeTreakfik
        );

        const lastCommit = await getLastCommitFromBranch(
            project.repo_url,
            project.branch,
            existUser.github_token!
        );

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
        sendSocketContent("deploy_logs", {
            deployId: buildDeploy.id,
            projectId: projectId,
            status: "building",
            message: "Iniciando build do deploy"
        });
        // verificar se existeo dockerfile no targetPath para continuar
        if (!fs.existsSync(path.join(targetPath, "Dockerfile"))) {
            await prisma.deploy.update({
                where: { id: buildDeploy.id },
                data: {
                    status: "failed",
                    success: false
                }
            });
            sendSocketContent("deploy_logs", {
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
            fs.writeFileSync(path.join(targetPath, ".env"), envContent);
        }
        // subir container
        exec(
            "git pull && docker-compose down && docker-compose up -d --build",
            { cwd: targetPath },
            async (error, stdout, stderr) => {
                if (error) {
                    console.error("[docker error]", stderr);
                    await prisma.deploy.update({
                        where: { id: buildDeploy.id },
                        data: {
                            status: "failed",
                            success: false
                        }
                    });
                    sendSocketContent("deploy_logs", {
                        deployId: buildDeploy.id,
                        projectId: projectId,
                        status: "failed",
                        message: "Erro ao construir o deploy: " + stderr
                    });
                    return;
                }

                console.log("[docker]", stdout);
                const logSplit = stdout.split("\n");
                sendSocketContent("deploy_logs", {
                    deployId: buildDeploy.id,
                    projectId: projectId,
                    status: "building",
                    message: logSplit[logSplit.length - 2] || "Build do deploy concluído"
                });
                collectLogs(buildDeploy.id, projectId, logSplit);
                await prisma.deploy.update({
                    where: { id: buildDeploy.id },
                    data: {
                        status: "running",
                        success: true
                    }
                });
                sendSocketContent("deploy_logs", {
                    deployId: buildDeploy.id,
                    projectId: projectId,
                    status: "running",
                    message: "Deploy executando com sucesso"
                });
                startLogStream(buildDeploy.id, projectId, project.domain);
            }
        );
        return { statusCode: 200, message: "Deploy iniciado" };
}