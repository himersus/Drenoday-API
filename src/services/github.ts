import { exec } from "node:child_process";
import { decryptToken } from "../utils/crypt";
import { parseGithubRepo, repositoryUsesDocker } from "../utils/github";
import prisma from "../lib/prisma";

export function decryptGithubToken(encryptedToken: string): string | null {
  return decryptToken(encryptedToken);
}

export async function validateGithubRepo(repoUrl: string, token: string): Promise<void> {
  const parsed = parseGithubRepo(repoUrl);
  if (!parsed) {
    throw new Error("URL do repositório GitHub inválida");
  }
  if ((await repositoryUsesDocker(parsed.owner, parsed.repo, token)) === false) {
    throw new Error("O repositório deve conter um Dockerfile na raiz");
  }
}

export async function verifyGithubSession(token: string): Promise<void> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!response.ok) {
    throw new Error("A sua sessão do GitHub expirou, por favor sincronize novamente");
  }
}

export function buildCloneUrl(repoUrl: string, token: string): string {
  return repoUrl.replace("https://", `https://x-access-token:${token}@`);
}

export function cloneRepository(
  cloneUrl: string,
  targetPath: string,
  branch: string,
  projectId: string
): void {
  const cmd = `mkdir -p ${targetPath} && git clone -b ${branch} "${cloneUrl}" "${targetPath}"`;

  exec(cmd, (error, _stdout, stderr) => {
    const status = error ? "failed" : "cloned";
    console.log(`Erro ${error}`);
    console.log(`Stderr ${stderr}`);
    console.log(`output: ${_stdout}`);
    prisma.project.update({ where: { id: projectId }, data: { clone: status } });
    if (error) console.error(`Erro ao clonar: ${error.message}`);
    if (stderr) console.error(`info: ${stderr}`);
  });
}