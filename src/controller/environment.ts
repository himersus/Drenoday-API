import prisma from "../lib/prisma";
import { Request, Response } from "express";
import { encryptEnv } from "../utils/crypt";
import { q } from "../utils/to_string";

export const saveEnvVars = async (req: Request | any, res: Response) => {
  const userId = req.userId;
  const projectId = q(req.params.projectId) as string;
  const { environments } = req.body; // [{ key: "DATABASE_URL", value: "postgres://..." }]

  const existUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existUser) {
    return res.status(404).json({ message: "Usuário não encontrado" });
  }

  const members = await prisma.user_workspace.findMany({
    where: { userId, projectId },
  });

  if (members.length === 0) {
    return res
      .status(403)
      .json({ message: "Você não tem acesso a este projeto" });
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    return res.status(404).json({ message: "Projeto não encontrado" });
  }

  // Criptografa e salva cada var
  const upserts = environments.map(
    ({ key, value }: { key: string; value: string }) =>
      prisma.environment.upsert({
        where: { projectId_key: { projectId, key } },
        update: { value: encryptEnv(value) },
        create: { projectId, key, value: encryptEnv(value) },
      }),
  );

  await prisma.$transaction(upserts);

  return res.status(200).json({ message: "Variáveis salvas com sucesso" });
};

export const getEnvVars = async (req: Request | any, res: Response) => {
  const userId = req.userId;
  const projectId = q(req.params.projectId) as string;
  const page = parseInt(q(req.query.page) || "1");
  const per_page = parseInt(q(req.query.per_page) || "10");

  const existUser = await prisma.user.findFirst({
    where: { id: userId },
  });

  if (!existUser) {
    return res.status(404).json({ message: "Usuário não encontrado" });
  }

  const members = await prisma.user_workspace.findMany({
    where: { userId, projectId },
  });

  if (members.length === 0) {
    return res
      .status(403)
      .json({ message: "Você não tem acesso a este projeto" });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    return res.status(404).json({ message: "Projeto não encontrado" });
  }

  const vars = await prisma.environment.findMany({
    where: { projectId },
    select: {
      id: true,
      key: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
    }, // nunca retorna o value
  });

  const count = await prisma.environment.count({
    where: { projectId },
  });

  return res.status(200).json({
    data: vars,
    meta: {
      page: page,
      per_page: per_page,
      total: count,
      total_pages: Math.ceil(count / per_page),
    },
  });
};

export const deleteEnvVar = async (req: Request | any, res: Response) => {
  const userId = req.userId;
  const projectId = q(req.params.projectId) as string;
  const envId = q(req.params.envId) as string;

  const existUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existUser) {
    return res.status(404).json({ message: "Usuário não encontrado" });
  }

  const members = await prisma.user_workspace.findMany({
    where: { userId, projectId },
  });

  if (members.length === 0) {
    return res
      .status(403)
      .json({ message: "Você não tem acesso a este projeto" });
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  });

  if (!project) {
    return res.status(404).json({ message: "Projeto não encontrado" });
  }

  const existEnv = await prisma.environment.findFirst({
    where: { id: envId, projectId },
  });

  if (!existEnv) {
    return res
      .status(404)
      .json({ message: "Variável de ambiente não encontrada" });
  }

  await prisma.environment.delete({
    where: { id: envId },
  });

  return res.status(200).json({ message: "Variável deletada com sucesso" });
};
