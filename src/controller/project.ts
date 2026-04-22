import { Request, Response } from "express";
import { validate } from "uuid";
import { generateUniqueSubdomain } from "../modify/domain";
import { stopProject } from "../services/stopProject";
import { runProject } from "../services/runProject";
import { q } from "../utils/to_string";
import prisma from "../lib/prisma";
import { assertGithubLinked, validateUserInput } from "../services/project";
import { createMember, fetchUserById } from "../services/user";
import {
  buildCloneUrl,
  cloneRepository,
  decryptGithubToken,
  validateGithubRepo,
  verifyGithubSession,
} from "../services/github";
import { computeProjectAmount, computeProjectDays } from "../utils/project";

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

  const inputResult = validateUserInput(port, period_duration);
  if (!inputResult.valid) {
    return res
      .status(inputResult.status)
      .json({ message: inputResult.message });
  }

  if (!name) {
    return res.status(400).json({ message: "O nome do projeto é obrigatório" });
  }

  try {
    const existUser = await fetchUserById(userId);
    if (!existUser)
      return res.status(404).json({ message: "Usuário não encontrado" });

    const githubCheck = assertGithubLinked(existUser);
    if (!githubCheck.linked)
      return res.status(400).json({ message: githubCheck.message });

    const existPlan = await prisma.plan.findFirst({
      where: { name: default_plan },
    });
    if (!existPlan)
      return res.status(400).json({
        message:
          "O plano escolhido não está disponível, por favor escolha outro",
      });

    const subdomain = await generateUniqueSubdomain(name);
    if (!subdomain)
      return res
        .status(500)
        .json({ message: "Não foi possível gerar um subdomínio único" });
    if (!existUser.github_token)
      return res
        .status(400)
        .json({ message: "Token do GitHub não encontrado" });
    const token = decryptGithubToken(existUser.github_token);
    if (!token)
      return res
        .status(500)
        .json({ message: "Erro ao descriptografar token do GitHub" });

    try {
      await validateGithubRepo(repo_url, token);
    } catch (error) {
      return res.status(400).json({
        message: "Erro ao verificar o repositório: " + (error as Error).message,
      });
    }

    await verifyGithubSession(token);

    const days = computeProjectDays(
      existPlan.duration,
      default_type_payment,
      period_duration,
    );

    const amount = computeProjectAmount(
      existPlan.price,
      default_type_payment,
      period_duration,
    );

    const base_domain = process.env.BASE_DOMAIN;
    if (!base_domain) {
      return res.status(500).json({ message: "Base domain não configurado" });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        branch,
        repo_url,
        default_plan: existPlan.name,
        port: `${port}`,
        userId: existUser.id,
        subdomain: subdomain as string,
        domain: `https://${subdomain}.${base_domain}`,
        environments: environments || [],
        days,
        amount_to_pay: amount,
      },
    });

    await createMember(existUser.id, project.id);

    const deployDir = process.env.DEPLOY_DIR;
    const targetPath = `${deployDir}/${existUser.username}/${project.subdomain}`;
    cloneRepository(
      buildCloneUrl(project.repo_url, token),
      targetPath,
      project.branch,
      project.id,
    );

    return res.status(201).json({ ...project, paid: false });
  } catch (error) {
    return res.status(500).json({
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

  const existUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existUser) {
    return res.status(404).json({ message: "Usuário não encontrado" });
  }

  const userWorkspace = await prisma.user_workspace.findFirst({
    where: {
      userId,
      projectId: existProject.id,
    },
  });

  if (!userWorkspace) {
    return res
      .status(403)
      .json({ message: "Você não tem acesso a este projeto" });
  }

  if (!existProject.date_expire || existProject.date_expire < new Date()) {
    return res.status(403).json({
      message: "Renove o pagamento para continuar ou contacte o suporte.",
    });
  }

  try {
    const runResponse = await runProject(projectId, userId);
    await prisma.project.update({
      where: { id: projectId },
      data: { repo_saved: true },
    });
    if (runResponse) {
      return res
        .status(runResponse.statusCode)
        .json({ message: runResponse.message });
    }

    res.status(400).json({ message: "Falha ao executar o projeto" });
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
        projectId: project.id,
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
    const last_deploy = await prisma.deploy.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
    });

    const last_payment = await prisma.payment.findFirst({
      where: { projectId: project.id, status: "completed" },
      orderBy: { createdAt: "desc" },
    });

    return res
      .status(200)
      .json({ ...project, paid: paid, deploy: last_deploy, payment: last_payment });
  } catch (error) {
    return res.status(500).json({ message: "erro ao buscar projeto" });
  }
};

export const getMyProjects = async (req: Request | any, res: Response) => {
  const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId
  const page = parseInt(req.query.page as string) || 1;
  const name = req.query.name as string | undefined;
  const per_page = parseInt(req.query.per_page as string) || 10;
  if (!validate(userId)) {
    return res.status(401).json({ message: "Usuário não autenticado" });
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        userId,
        name: name ? { contains: name, mode: "insensitive" } : undefined,
      },
      skip: (page - 1) * per_page,
      take: per_page,
      orderBy: {
        createdAt: "desc",
      },
    });

    const projectsWithPaymentStatus = await Promise.all(
      projects.map(async (project) => {
        let paid = false;
        const now = new Date();
        if (project.date_expire && project.date_expire > now) {
          paid = true;
        }
        const last_deploy = await prisma.deploy.findFirst({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
        });

        const last_payment = await prisma.payment.findFirst({
          where: { projectId: project.id, status: "completed" },
          orderBy: { createdAt: "desc" },
        });

        return { ...project, paid, deploy: last_deploy, payment: last_payment };
      }),
    );

    const totalProjects = await prisma.project.count({
      where: {
        userId,
        name: name ? { contains: name, mode: "insensitive" } : undefined,
      },
    });

    const total_page = Math.ceil(totalProjects / per_page);

    res.status(200).json({
      data: projectsWithPaymentStatus,
      meta: {
        page,
        per_page,
        total_pages: total_page,
      },
    });
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
        projectId: project.id,
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
        projectId: project.id,
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
