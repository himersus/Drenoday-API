import CryptoJS from "crypto-js";

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

    const bytes = CryptoJS.AES.decrypt(encrypted, process.env.JWT_SECRET!);
    const token = bytes.toString(CryptoJS.enc.Utf8);
    
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