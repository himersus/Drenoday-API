import { Request, Response } from "express";
import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { validate } from "uuid";
import { generateUniqueDomain } from "../modify/domain";
import { exec } from "child_process";
import CryptoJS from "crypto-js";
import fs from "fs";
import { spawn } from "child_process";
const prisma = new PrismaClient();

export const createProject = async (req: Request | any, res: Response) => {
    const { name, description, branch, repo_url, environments, workspaceId, time_in_day, amount } = req.body;
    const userId = req.userId;

    if (!validate(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    if (!repo_url) {
        return res.status(400).json({ message: "Branch e Repo URL devem ser strings" });
    }

    try {
        const existUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: validate(userId) ? userId : undefined },
                    { username: userId },
                    { email: userId }
                ]
            },
        });

        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        if (!existUser.github_id || !existUser.github_token || !existUser.github_username) {
            return res.status(400).json({ message: "Informações do GitHub são obrigatórias, tente sincronizar com o github" });
        }

        if (!name) {
            return res.status(400).json({ message: "O nome do projeto é obrigatório" });
        }

        const domain = await generateUniqueDomain(name);

        if (!domain) {
            return res.status(500).json({ message: "Não foi possível gerar um domínio único" });
        }

        if (typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({
                message: "O valor do pagamento é inválido"
            });
        }

        const project = await prisma.project.create({
            data: {
                name,
                description,
                workspaceId,
                branch,
                repo_url,
                userId: existUser.id,
                domain: domain as string,
                environments: environments || [],
            }
        });

        const payment = await prisma.payment.create({
            data: {
                userId: existUser.id,
                amount: amount,
                time_in_day: time_in_day || 0,
                status: 'pending',
                type_payment: 'monthly',
                qty_months: 1,
                projectId: project.id
            }
        });

        const encrypted = existUser.github_token;

        const bytes = CryptoJS.AES.decrypt(encrypted, process.env.JWT_SECRET!);
        const token = bytes.toString(CryptoJS.enc.Utf8);

        const response = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json"
            }
        });

        if (!response.ok) {
            return res
                .status(response.status)
                .json({
                    message: "A sua sessão do GitHub expirou, por favor sincronize novamente"
                });
        }

        // clone_url vindo da API do GitHub: "https://github.com/user/exemplo.git"
        const cloneUrl = repo_url.replace("https://", `https://x-access-token:${token}@`);
        const deployDir = process.env.DEPLOY_DIR;
        const targetPath = `${deployDir}/${existUser.username}/${project.domain}`;

        const cmd = `
mkdir -p ${targetPath} \
&& git clone -b ${project.branch} "${cloneUrl}" "${targetPath}"
`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                prisma.project.update({
                    where: { id: project.id },
                    data: { clone: 'failed' }
                });
                console.error(`Erro ao executar comandos: ${error.message}`);
                return;
            }

            if (stderr) {
                console.error(`info : ${stderr}`);
            }

            // enviar um socket a dizer que o deploy foi criado com sucesso
            prisma.project.update({
                where: { id: project.id },
                data: { clone: 'cloned' }
            });

            console.log(`stdout: ${stdout}`);
        });
        res.status(201).json(project);
    } catch (error) {
        res.status(500).json({
            message: "Failed to create project",
            error: (error as Error).message
        });
    }
};

export const runTheProject = async (req: Request | any, res: Response) => {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!validate(projectId) || !validate(userId)) {
        return res.status(400).json({ message: "ID inválido" });
    }

    try {
        const project = await prisma.project.findFirst({
            where: { id: projectId },
        });

        if (!project) {
            return res.status(404).json({ message: "Projeto não encontrado" });
        }

        const existUser = await prisma.user.findFirst({
            where: { id: userId },
        });

        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }

        if (project.userId !== userId) {
            return res.status(403).json({ message: "Você não tem permissão para executar este projeto" });
        }

        if (project.clone !== 'cloned') {
            return res.status(400).json({ message: "O repositório ainda não foi clonado completamente" });
        }

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
      - "traefik.http.routers.${project.domain}.rule=Host(\`${project.domain}\`)"
      - "traefik.http.routers.${project.domain}.entrypoints=websecure"
      - "traefik.http.routers.${project.domain}.tls.certresolver=myresolver"
      - "traefik.http.services.${project.domain}.loadbalancer.server.port=${project.port}"
    networks:
      - traefik-network
networks:
  traefik-network:
    external: true
`;

        fs.writeFileSync(`${targetPath}/docker-compose.yml`, createComposeTreakfik);

        const deploy = spawn("docker-compose", ["up", "-d", "--build"], { cwd: targetPath });

        deploy.stdout.on("data", (data) => {
            console.log(`stdout: ${data}`);
        });

        deploy.stderr.on("data", (data) => {
            console.error(`stderr: ${data}`);
        });

        deploy.on("close", (code) => {
            if (code === 0) {
                prisma.project.update({
                    where: { id: project.id },
                    data: { run_status: "running" }
                });
                // Enviar socket notificando sucesso
            } else {
                prisma.project.update({
                    where: { id: project.id },
                    data: { run_status: "failed" }
                });
                // Enviar socket notificando erro
            }
        });
        res.status(200).json({ message: "Projeto iniciado com sucesso" });
    } catch (error) {
        res.status(500).json({ error: "Failed to run project" });
    }
};

export const getProject = async (req: Request | any, res: Response) => {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!validate(projectId) || !validate(userId)) {
        return res.status(400).json({ message: "ID inválido" });
    }
    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            return res.status(404).json({ message: "Projeto não encontrado" });
        }

        const userWorkspace = await prisma.user_workspace.findFirst({
            where: {
                userId,
                workspaceId: project.workspaceId
            }
        });

        if (!userWorkspace) {
            return res.status(403).json({ message: "Você não tem acesso a este projeto" });
        }
        return res.status(200).json(project);
    } catch (error) {
        return res.status(500).json({ message: "erro ao buscar projeto" });
    }
};

export const getMyProjects = async (req: Request | any, res: Response) => {
    const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId
    const workspaceId = req.params.workspaceId;
    try {
        const projects = await prisma.project.findMany({
            where: { userId, workspaceId },
        });

        res.status(200).json(projects);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve projects" });
    }
};

export const updateProject = async (req: Request | any, res: Response) => {
    const { projectId } = req.params;
    const { name, description, environments } = req.body;
    const userId = req.userId;

    if (!validate(projectId) || !validate(userId)) {
        return res.status(400).json({ message: "ID inválido" });
    }

    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            return res.status(404).json({ message: "Projeto não encontrado" });
        }

        if (project.userId !== userId) {
            return res.status(403).json({ message: "Você não tem permissão para atualizar este projeto" });
        }

        const updatedProject = await prisma.project.update({
            where: { id: projectId },
            data: {
                name: name || project.name,
                description: description || project.description,
                environments: environments || project.environments,
            },
        });

        res.status(200).json(updatedProject);
    } catch (error) {
        res.status(500).json({ error: "Failed to update project" });
    }
};

export const deleteProject = async (req: Request | any, res: Response) => {
    const { projectId } = req.params;
    const userId = req.userId;

    if (!validate(projectId) || !validate(userId)) {
        return res.status(400).json({ message: "ID inválido" });
    }

    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
        });

        if (!project) {
            return res.status(404).json({ message: "Projeto não encontrado" });
        }

        if (project.userId !== userId) {
            return res.status(403).json({ message: "Você não tem permissão para deletar este projeto" });
        }

        await prisma.payment.deleteMany({
            where: { projectId: projectId },
        });

        await prisma.project.delete({
            where: { id: projectId },
        });

        res.status(200).json({ message: "Projeto deletado com sucesso" });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete project",
            error: (error as Error).message
        });
    }
};

export const GetPendingProjectsPayments = async (req: Request | any, res: Response) => {
    const userId = req.userId;
    let status = req.query.status || 'pending';


    if (status !== 'pending' && status !== 'completed' && status !== 'failed') {
        status = 'pending';
    }

    try {
        const payments = await prisma.payment.findMany({
            where: {
                userId: userId,
                status: status
            },
            include: {
                project: true
            }
        });

        res.status(200).json(payments);
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve pending payments" });
    }
};
