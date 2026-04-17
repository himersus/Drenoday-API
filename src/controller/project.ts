import { Request, Response } from "express";
import { validate } from "uuid";
import { generateUniqueDomain } from "../modify/domain";
import { exec } from "child_process";
import CryptoJS from "crypto-js";
import { parseGithubRepo } from "../helper/github";
import { stopProject } from "../services/stopProject";
import { runProject } from "../services/runProject";
import { q } from "../helper/to_string";
import prisma from "../lib/prisma";
import { decryptToken } from "../helper/crypt";

async function repositoryUsesDocker(
  owner: string,
  repo: string,
  githubToken: string,
): Promise<boolean> {
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    // Verifica se existe Dockerfile na raiz
    const dockerfileResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/Dockerfile`,
      { headers },
    );

    if (dockerfileResponse.ok) {
      return true;
    }

    // Verifica se existe docker-compose.yml ou docker-compose.yaml
    /*const composeYmlResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/docker-compose.yml`,
            { headers }
        );

        if (composeYmlResponse.ok) {
            return true;
        }*/

    /*const composeYamlResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/docker-compose.yaml`,
            { headers }
        );

        if (composeYamlResponse.ok) {
            return true;
        }*/

    // Verifica se existe pasta .docker
    const dockerDirResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/.docker`,
      { headers },
    );

    if (dockerDirResponse.ok) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("Erro ao verificar Docker no repositório:", error);
    throw error;
  }
}

// {{Create projecto}}
export const createProject = async (req: Request | any, res: Response) => {
  const {
    name,
    description,
    branch,
    port,
    repo_url,
    environments,
    default_plan,
    default_type_payment,
    period_duration,
  } = req.body;

  const userId = req.userId;

  if (!validate(userId) || !userId) {
    return res.status(401).json({ message: "Usuário não autenticado" });
  }

  const portNumber = Number(port);

  if (!port || typeof port !== "string" || !Number.isInteger(portNumber)) {
    return res.status(400).json({
      message: "Porta é obrigatório e deve ser um número valido",
    });
  }

  if (period_duration && (!Number.isInteger(period_duration) || period_duration <= 0)) {
    return res.status(400).json({
      message: "Duração do período deve ser um número inteiro positivo",
    });
  }

  if (portNumber < 1024 || portNumber > 65535) {
    return res.status(400).json({
      message: "Porta deve estar entre 1024 e 65535",
    });
  }

  try {
    const existUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: validate(userId) ? userId : undefined },
          { username: userId },
          { email: userId },
        ],
      },
    });

    if (!existUser) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    if (
      !existUser.github_id ||
      !existUser.github_token ||
      !existUser.github_username
    ) {
      return res.status(400).json({
        message:
          "Informações do GitHub são obrigatórias, tente sincronizar com o github",
      });
    }

    if (!name) {
      return res
        .status(400)
        .json({ message: "O nome do projeto é obrigatório" });
    }

    const existPlan = await prisma.plan.findFirst({
      where: {
        name: {
          mode: "insensitive",
          equals: default_plan,
        },
      },
    });

    if (!existPlan || !default_plan) {
      return res.status(400).json({
        message:
          "O plano escolhido não está disponível, por favor escolha outro",
      });
    }

    const domain = await generateUniqueDomain(name);

    if (!domain) {
      return res
        .status(500)
        .json({ message: "Não foi possível gerar um domínio único" });
    }

    const encrypted = existUser.github_token;

    const token = decryptToken(encrypted);

    if (!token) {
      return res.status(500).json({
        message: "Erro ao descriptografar token do GitHub",
      });
    }

    try {
      const parsed = parseGithubRepo(repo_url);
      if (!parsed) {
        return res.status(400).json({
          message: "URL do repositório GitHub inválida",
        });
      }
      if (
        (await repositoryUsesDocker(parsed.owner, parsed.repo, token)) === false
      ) {
        return res.status(400).json({
          message: "O repositório deve conter um Dockerfile na raiz",
        });
      }
    } catch (error) {
      return res.status(400).json({
        message: "Erro ao verificar o repositório: " + (error as Error).message,
      });
    }

    let days = 0;
    if (existPlan.duration < 30) days = existPlan.duration;
    else if (default_type_payment === "monthly") days = period_duration * 30;
    else if (default_type_payment === "yearly") days = period_duration * 360;
    else if (!period_duration) days = existPlan.duration;

    // console.log(`Criando projeto para o usuário ${existUser.username} com o repositório ${repo_url}`);

    const project = await prisma.project.create({
      data: {
        name, // nome do projeto
        description, // descrição do projeto
        branch, // branch do repositório
        repo_url, // URL do repositório
        default_plan: existPlan.name, // plano escolhido
        port: `${port}`, // porta onde a aplicação irá rodar
        userId: existUser.id, // ID do usuário que criou o projeto
        domain: domain as string, // domínio único gerado
        environments: environments || [], // variáveis de ambiente
        days: days || 0, // duração do período
      },
    });

    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        message:
          "A sua sessão do GitHub expirou, por favor sincronize novamente",
      });
    }

    // clone_url vindo da API do GitHub: "https://github.com/user/exemplo.git"
    const cloneUrl = repo_url.replace(
      "https://",
      `https://x-access-token:${token}@`,
    );
    const deployDir = process.env.DEPLOY_DIR;
    const targetPath = `${deployDir}/${existUser.username}/${project.domain}`;

    const cmd = `
mkdir -p ${targetPath} \
&& git clone -b ${project.branch} "${cloneUrl}" "${targetPath}"
`;
    exec(cmd, (error: any, stdout: string, stderr: string) => {
      if (error) {
        prisma.project.update({
          where: { id: project.id },
          data: { clone: "failed" },
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
        data: { clone: "cloned" },
      });

      console.log(`stdout: ${stdout}`);
    });
    res.status(201).json({ ...project, paid: false });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create project",
      error: (error as Error).message,
    });
  }
};

export const runTheProject = async (req: Request | any, res: Response) => {
  const projectId = q(req.params.projectId);
  const userId = req.userId;

  if (!validate(projectId) || !validate(userId)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  const existProject = await prisma.project.findFirst({
    where: { id: projectId },
  });

  if (!existProject) {
    return res.status(404).json({ message: "Projeto não encontrado" });
  }

  const userWorkspace = await prisma.user_workspace.findFirst({
    where: {
      userId,
      ProjectId: existProject.id,
    },
  });

  if (!userWorkspace) {
    return res
      .status(403)
      .json({ message: "Você não tem acesso a este projeto" });
  }

  if (!existProject.date_expire || existProject.date_expire < new Date()) {
    return res.status(403).json({
      message:
        "O plano associado a este projeto expirou. Por favor, renove o plano para continuar.",
    });
  }

  try {
    const runResponse = await runProject(projectId, userId);
    if (runResponse) {
      return res
        .status(runResponse.statusCode)
        .json({ message: runResponse.message });
    }
    res.status(200).json({ message: "Projeto em execução" });
  } catch (error: any) {
    res.status(400).json({
      message: "Falha ao executar o projeto",
      error: error.message,
    });
  }
};

export const stopTheProject = async (req: Request | any, res: Response) => {
  const projectId = q(req.params.projectId);
  const userId = req.userId;

  if (!validate(projectId) || !validate(userId)) {
    return res.status(400).json({ message: "ID inválido" });
  }

  try {
    const stopResponse = await stopProject(projectId, userId);

    if (stopResponse && stopResponse.statusCode !== 200) {
      return res
        .status(stopResponse.statusCode)
        .json({ message: stopResponse.message });
    }

    res.status(200).json({ message: "Projeto parado com sucesso" });
  } catch (error: any) {
    res.status(500).json({
      message: "Failed to stop project",
      error: error.message,
    });
  }
};

export const getProject = async (req: Request | any, res: Response) => {
  const projectId = q(req.params.projectId);
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
        ProjectId: project.id,
      },
    });

    let paid = false;
    const now = new Date();
    if (project.date_expire && project.date_expire > now) {
      paid = true;
    }
    if (!userWorkspace) {
      return res
        .status(403)
        .json({ message: "Você não tem acesso a este projeto" });
    }
    return res.status(200).json({ ...project, paid: paid });
  } catch (error) {
    return res.status(500).json({ message: "erro ao buscar projeto" });
  }
};

export const getMyProjects = async (req: Request | any, res: Response) => {
  const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId
  if (!validate(userId)) {
    return res.status(401).json({ message: "Usuário não autenticado" });
  }

  const userWorkspace = await prisma.user_workspace.findFirst({
    where: {
      userId,
    },
  });

  if (!userWorkspace) {
    return res
      .status(403)
      .json({ message: "Você não tem acesso a este workspace" });
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId },
    });

    const projectsWithPaymentStatus = projects.map((project) => {
      let paid = false;
      const now = new Date();
      if (project.date_expire && project.date_expire > now) {
        paid = true;
      }
      return { ...project, paid };
    });

    res.status(200).json(projectsWithPaymentStatus);
  } catch (error) {
    res.status(500).json({ message: "Falha ao recuperar projetos" });
  }
};

export const updateProject = async (req: Request | any, res: Response) => {
  const projectId = q(req.params.projectId);
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

    const userWorkspace = await prisma.user_workspace.findFirst({
      where: {
        userId,
        ProjectId: project.id,
      },
    });

    if (!userWorkspace || userWorkspace.role !== "master") {
      return res
        .status(403)
        .json({ message: "Você não tem acesso a este projeto" });
    }

    /*if (default_plan) {
            const existPlan = await prisma.plan.findFirst({
                where: {
                    name: default_plan
                }
            });

            if (!existPlan) {
                return res.status(400).json({ message: "O plano escolhido não está disponível, por favor escolha outro" });
            }
        }*/

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: name || project.name,
        description: description || project.description,
        default_plan: "default",
        environments: environments || project.environments,
        //port: port || project.port, // carece de logica para validar se a porta é diferente e se é válida, caso seja diferente da porta atual, tem de verificar se a nova porta está disponível
        // branch: branch || project.branch, // carece de lógica para verificar se a branch é diferente e se existe no repositório
      },
    });

    res.status(200).json(updatedProject);
  } catch (error) {
    res.status(500).json({ error: "Falha ao atualizar projeto" });
  }
};

export const deleteProject = async (req: Request | any, res: Response) => {
  const projectId = q(req.params.projectId);
  const userId = req.userId;

  if (!validate(projectId) || !validate(userId)) {
    return res.status(400).json({ message: "Projecto ou utilizador inválido" });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ message: "Projeto não encontrado" });
    }

    const userWorkspace = await prisma.user_workspace.findFirst({
      where: {
        userId,
        ProjectId: project.id,
      },
    });

    if (!userWorkspace || userWorkspace.role !== "master") {
      return res
        .status(403)
        .json({ message: "Você não tem acesso a este projeto" });
    }

    await prisma.payment.deleteMany({
      where: { projectId: projectId },
    });

    await prisma.deploy.deleteMany({
      where: { projectId: projectId },
    });

    await prisma.project.delete({
      where: { id: projectId },
    });

    res.status(200).json({ message: "Projeto deletado com sucesso" });
  } catch (error) {
    res.status(500).json({
      message: "Falha ao deletar projeto",
      error: (error as Error).message,
    });
  }
};
