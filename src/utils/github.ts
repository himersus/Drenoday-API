import CryptoJS from "crypto-js";
import { decryptToken } from "./crypt";

export function parseGithubRepo(url: string) {
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


export async function getLastCommitFromBranch(
    repoUrl: string,
    branch: string,
    github_token: string
) {
    const parsed = parseGithubRepo(repoUrl);
    if (!parsed) {
        throw new Error("URL do GitHub inválida");
    }

    const { owner, repo } = parsed;

    const headers: any = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "drenoday"
    };

    const encrypted = github_token;

    const token = decryptToken(encrypted);
    
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
        { headers }
    );

    if (response.status === 404) {
        throw new Error(
            "Repositório ou branch não encontrada (ou repo privado sem permissão)"
        );
    }

    if (!response.ok) {
        throw new Error(`Erro GitHub API (${response.status})`);
    }

    const commit = await response.json();

    return {
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author?.name ?? "Desconhecido",
        email: commit.commit.author?.email ?? null,
        date: commit.commit.author?.date,
        url: commit.html_url
    };
}

export async function repositoryUsesDocker(
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