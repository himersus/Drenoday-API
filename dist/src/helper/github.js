"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGithubRepo = parseGithubRepo;
exports.getLastCommitFromBranch = getLastCommitFromBranch;
const crypt_1 = require("./crypt");
function parseGithubRepo(url) {
    const clean = url
        .replace(/\.git$/, "")
        .replace(/\/$/, "")
        .split("/");
    if (clean.length < 5)
        return null;
    return {
        owner: clean[3],
        repo: clean[4]
    };
}
async function getLastCommitFromBranch(repoUrl, branch, github_token) {
    const parsed = parseGithubRepo(repoUrl);
    if (!parsed) {
        throw new Error("URL do GitHub inválida");
    }
    const { owner, repo } = parsed;
    const headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "drenoday"
    };
    const encrypted = github_token;
    const token = (0, crypt_1.decryptToken)(encrypted);
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${branch}`, { headers });
    if (response.status === 404) {
        throw new Error("Repositório ou branch não encontrada (ou repo privado sem permissão)");
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
