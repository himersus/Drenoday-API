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
import path from "path";
const prisma = new PrismaClient();
import {sendSocketContent} from "../sockets/index"
import { startLogStream } from "../helper/logs";


function parseGithubRepo(url: string) {
    const clean = url
        .replace(/\.git$/, "")
        .replace(/\/$/, "")
        .split("/");

    if (clean.length < 5) return null;

    return {
        owner: clean[3],
        repo: clean[4]
    };
}

async function repositoryUsesDocker(
  owner: string,
  repo: string,
  githubToken: string
): Promise<boolean> {
  const headers = {
    'Authorization': `Bearer ${githubToken}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  try {
    // Verifica se existe Dockerfile na raiz
    const dockerfileResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/Dockerfile`,
      { headers }
    );

    if (dockerfileResponse.ok) {
      return true;
    }

    // Verifica se existe docker-compose.yml ou docker-compose.yaml
    const composeYmlResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/docker-compose.yml`,
      { headers }
    );

    if (composeYmlResponse.ok) {
      return true;
    }

    const composeYamlResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/docker-compose.yaml`,
      { headers }
    );

    if (composeYamlResponse.ok) {
      return true;
    }

    // Verifica se existe pasta .docker
    const dockerDirResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/.docker`,
      { headers }
    );

    if (dockerDirResponse.ok) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Erro ao verificar Docker no repositório:', error);
    throw error;
  }
}

// {{Create projecto}}
export const createProject = async (req: Request | any, res: Response) => {
    const { name, description, branch, port, repo_url, environments, workspaceId, time_in_day, amount } = req.body;
    const userId = req.userId;

    if (!validate(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    if (!repo_url) {
        return res.status(400).json({ message: "Branch e Repo URL devem ser strings" });
    }

    if (!branch || typeof branch !== 'string') {
        return res.status(400).json({ message: "Branch é obrigatório e deve ser uma string" });
    }

    const portNumber = Number(port);

    if (!port || typeof port !== 'string' || !Number.isInteger(portNumber)) {
        return res.status(400).json({
            message: "Port é obrigatório e deve ser um número valido"
        });
    }

    if (portNumber < 1024 || portNumber > 65535) {
        return res.status(400).json({
            message: "Port deve estar entre 1024 e 65535"
        });
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

        const encrypted = existUser.github_token;

        const bytes = CryptoJS.AES.decrypt(encrypted, process.env.JWT_SECRET!);
        const token = bytes.toString(CryptoJS.enc.Utf8);

        if (!token) {
            return res.status(500).json({
                message: "Erro ao descriptografar token do GitHub"
            });
        }

        try {
            const parsed = parseGithubRepo(repo_url);
            if (!parsed) {
                return res.status(400).json({
                    message: "URL do repositório GitHub inválida"
                });
            }
            if (await repositoryUsesDocker(parsed.owner, parsed.repo, token) === false) {
                return res.status(400).json({
                    message: "O repositório deve conter um Dockerfile na raiz"
                });
            }
        } catch (error) {
            return res.status(400).json({
                message: "Erro ao verificar o repositório: " + (error as Error).message
            });
        }

        console.log(`Criando projeto para o usuário ${existUser.username} com o repositório ${repo_url}`);

        const project = await prisma.project.create({
            data: {
                name, // nome do projeto
                description, // descrição do projeto
                workspaceId, // workspaceId
                branch, // branch do repositório
                repo_url, // URL do repositório
                port: `${port}`, // porta onde a aplicação irá rodar
                userId: existUser.id, // ID do usuário que criou o projeto
                domain: domain as string, // domínio único gerado
                environments: environments || [], // variáveis de ambiente
            }
        });

        const payment = await prisma.payment.create({
            data: {
                userId: existUser.id, // ID do usuário que realizou o pagamento
                amount: amount, // valor do pagamento
                time_in_day: time_in_day || 0, // tempo em dias do pagamento
                status: 'pending', // status do pagamento
                type_payment: 'monthly', // tipo de pagamento
                qty_months: 1, // quantidade de meses
                projectId: project.id // ID do projeto associado ao pagamento
            }
        });



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
        exec(cmd, (error : any, stdout : string, stderr : string) => {
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

        const buildDeploy = await prisma.deploy.create({
            data : {
                projectId : projectId,
            }
        });

        // subir container
        exec(
        "docker-compose down && docker-compose up -d --build",
        { cwd: targetPath},
        async (error, stdout, stderr) => {
        if (error) {
            console.error("[docker error]", stderr);
            await prisma.deploy.update({
                where: { id: buildDeploy.id },
                data : {
                    status : "failed"
                }
            });
          
            return;
        }

        console.log("[docker]", stdout);

        await prisma.deploy.update({
            where: { id: buildDeploy.id },
            data: { status: "running" }
        });
        }
    );

        startLogStream(buildDeploy.id, project.domain);

        res.status(200).json({ message: "Deploy iniciado" });
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
