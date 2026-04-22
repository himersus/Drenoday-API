"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptGithubToken = decryptGithubToken;
exports.validateGithubRepo = validateGithubRepo;
exports.verifyGithubSession = verifyGithubSession;
exports.buildCloneUrl = buildCloneUrl;
exports.cloneRepository = cloneRepository;
const node_child_process_1 = require("node:child_process");
const crypt_1 = require("../utils/crypt");
const github_1 = require("../utils/github");
const prisma_1 = __importDefault(require("../lib/prisma"));
function decryptGithubToken(encryptedToken) {
    return (0, crypt_1.decryptToken)(encryptedToken);
}
async function validateGithubRepo(repoUrl, token) {
    const parsed = (0, github_1.parseGithubRepo)(repoUrl);
    if (!parsed) {
        throw new Error("URL do repositório GitHub inválida");
    }
    if ((await (0, github_1.repositoryUsesDocker)(parsed.owner, parsed.repo, token)) === false) {
        throw new Error("O repositório deve conter um Dockerfile na raiz");
    }
}
async function verifyGithubSession(token) {
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
function buildCloneUrl(repoUrl, token) {
    return repoUrl.replace("https://", `https://x-access-token:${token}@`);
}
function cloneRepository(cloneUrl, targetPath, branch, projectId) {
    const cmd = [
        `mkdir -p "${targetPath}"`,
        `GIT_TERMINAL_PROMPT=0 git clone --depth=1 -b "${branch}" "${cloneUrl}" "${targetPath}"`,
    ].join(" && ");
    (0, node_child_process_1.exec)(cmd, { timeout: 60000 }, async (error, _stdout, stderr) => {
        if (error) {
            await prisma_1.default.project.update({
                where: { id: projectId },
                data: { clone: "failed" },
            });
            console.error(`Erro ao clonar [${projectId}]: ${error.message}`);
            return;
        }
        console.log(stderr);
        await prisma_1.default.project.update({
            where: { id: projectId },
            data: { clone: "cloned" },
        });
        console.log(`Clone concluído [${projectId}]`);
    });
}
