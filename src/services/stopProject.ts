import { exec } from "child_process";
import prisma from "../lib/prisma";

type StopProjectResponse = {
  statusCode: number;
  message: string;
} | void;

export async function stopProject(
  projectId: string,
  userId: string,
): Promise<StopProjectResponse> {
  const project = await prisma.project.findFirst({
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

  const existUser = await prisma.user.findFirst({
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

  exec(
    "docker-compose down",
    { cwd: targetPath },
    async (error, stdout, stderr) => {
      if (error) {
        console.error(`[docker error]: ${stderr}`);
        return;
      }

      console.log(`[docker]: ${stdout}`);
    },
  );

  return {
    statusCode: 200,
    message: "Projeto parado com sucesso",
  };
}
