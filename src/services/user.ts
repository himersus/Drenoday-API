import { validate } from "uuid";
import prisma from "../lib/prisma";

export async function fetchUserById(userId: string) {
  if (!validate(userId) || !userId) return null;

  return prisma.user.findFirst({
    where: {
      OR: [
        { id: validate(userId) ? userId : undefined },
        { username: userId },
        { email: userId },
      ],
    },
  });
}

export async function createMember(userId: string, projectId: string) {
  const existUser = await fetchUserById(userId);
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!existUser || !project) {
    throw new Error("User or project not found");
  }

  await prisma.user_workspace.create({
    data: {
      userId: existUser.id,
      projectId: project.id,
      role: "master",
    },
  });
}
