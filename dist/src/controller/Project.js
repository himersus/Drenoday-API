"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProject = exports.updateProject = exports.getMyProjects = exports.getProject = exports.stopTheProject = exports.runTheProject = exports.createProject = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const domain_1 = require("../modify/domain");
const child_process_1 = require("child_process");
const crypto_js_1 = __importDefault(require("crypto-js"));
const prisma = new client_1.PrismaClient();
const github_1 = require("../helper/github");
const stopProject_1 = require("../services/stopProject");
const runProject_1 = require("../services/runProject");
async function repositoryUsesDocker(owner, repo, githubToken) {
    const headers = {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
    };
    try {
        // Verifica se existe Dockerfile na raiz
        const dockerfileResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/Dockerfile`, { headers });
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
        const dockerDirResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/.docker`, { headers });
        if (dockerDirResponse.ok) {
            return true;
        }
        return false;
    }
    catch (error) {
        console.error('Erro ao verificar Docker no repositório:', error);
        throw error;
    }
}
// {{Create projecto}}
const createProject = async (req, res) => {
    const { name, description, branch, port, repo_url, default_plan, environments, workspaceId } = req.body;
    const userId = req.userId;
    if (!(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    if (!repo_url || typeof repo_url !== 'string') {
        return res.status(400).json({ message: "O Repo URL deve ser uma string" });
    }
    if (!branch || typeof branch !== 'string') {
        return res.status(400).json({ message: "Branch é obrigatório e deve ser uma string" });
    }
    if (environments && !Array.isArray(environments)) {
        return res.status(400).json({ message: "Environments deve ser um array de strings : ex: ['port=3000']" });
    }
    const portNumber = Number(port);
    if (!port || typeof port !== 'string' || !Number.isInteger(portNumber)) {
        return res.status(400).json({
            message: "Porta é obrigatório e deve ser um número valido"
        });
    }
    if (portNumber < 1024 || portNumber > 65535) {
        return res.status(400).json({
            message: "Porta deve estar entre 1024 e 65535"
        });
    }
    try {
        const existUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: (0, uuid_1.validate)(userId) ? userId : undefined },
                    { username: userId },
                    { email: userId }
                ]
            },
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        if (!existUser.github_id || !existUser.github_token || !existUser.github_username) {
            return res.status(400).json({ message: "Informações do GitHub são obrigatórias, tente sincronizar com o github" });
        }
        if (!name) {
            return res.status(400).json({ message: "O nome do projeto é obrigatório" });
        }
        const existPlan = await prisma.plan.findFirst({
            where: {
                name: default_plan
            }
        });
        if (!existPlan) {
            return res.status(400).json({ message: "O plano escolhido não está disponível, por favor escolha outro" });
        }
        const domain = await (0, domain_1.generateUniqueDomain)(name);
        if (!domain) {
            return res.status(500).json({ message: "Não foi possível gerar um domínio único" });
        }
        const encrypted = existUser.github_token;
        const bytes = crypto_js_1.default.AES.decrypt(encrypted, process.env.GITHUB_TOKEN_ENCRYPTION_KEY);
        const token = bytes.toString(crypto_js_1.default.enc.Utf8);
        if (!token) {
            return res.status(500).json({
                message: "Erro ao descriptografar token do GitHub"
            });
        }
        try {
            const parsed = (0, github_1.parseGithubRepo)(repo_url);
            if (!parsed) {
                return res.status(400).json({
                    message: "URL do repositório GitHub inválida"
                });
            }
            if (await repositoryUsesDocker(parsed.owner, parsed.repo, token) === false) {
                return res.status(400).json({
                    message: "O repositório deve conter um Dockerfile na raiz"
                });
            }
        }
        catch (error) {
            return res.status(400).json({
                message: "Erro ao verificar o repositório: " + error.message
            });
        }
        // console.log(`Criando projeto para o usuário ${existUser.username} com o repositório ${repo_url}`);
        const project = await prisma.project.create({
            data: {
                name,
                description,
                workspaceId,
                branch,
                repo_url,
                default_plan: existPlan.name,
                port: `${port}`,
                userId: existUser.id,
                domain: domain,
                environments: environments || [], // variáveis de ambiente
            }
        });
        const response = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json"
            }
        });
        if (!response.ok) {
            return res
                .status(response.status)
                .json({
                message: "A sua sessão do GitHub expirou, por favor sincronize novamente"
            });
        }
        // clone_url vindo da API do GitHub: "https://github.com/user/exemplo.git"
        const cloneUrl = repo_url.replace("https://", `https://x-access-token:${token}@`);
        const deployDir = process.env.DEPLOY_DIR;
        const targetPath = `${deployDir}/${existUser.username}/${project.domain}`;
        const cmd = `
mkdir -p ${targetPath} \
&& git clone -b ${project.branch} "${cloneUrl}" "${targetPath}"
`;
        (0, child_process_1.exec)(cmd, (error, stdout, stderr) => {
            if (error) {
                prisma.project.update({
                    where: { id: project.id },
                    data: { clone: 'failed' }
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
                data: { clone: 'cloned' }
            });
            console.log(`stdout: ${stdout}`);
        });
        res.status(201).json({ ...project, paid: false });
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to create project",
            error: error.message
        });
    }
};
exports.createProject = createProject;
const runTheProject = async (req, res) => {
    const { projectId } = req.params;
    const userId = req.userId;
    if (!(0, uuid_1.validate)(projectId) || !(0, uuid_1.validate)(userId)) {
        return res.status(400).json({ message: "ID inválido" });
    }
    try {
        const runResponse = await (0, runProject_1.runProject)(projectId, userId);
        if (runResponse) {
            return res.status(runResponse.statusCode).json({ message: runResponse.message });
        }
        res.status(200).json({ message: "Projeto em execução" });
    }
    catch (error) {
        res.status(400).json({
            message: "Falha ao executar o projeto",
            error: error.message
        });
    }
};
exports.runTheProject = runTheProject;
const stopTheProject = async (req, res) => {
    const { projectId } = req.params;
    const userId = req.userId;
    if (!(0, uuid_1.validate)(projectId) || !(0, uuid_1.validate)(userId)) {
        return res.status(400).json({ message: "ID inválido" });
    }
    try {
        const stopResponse = await (0, stopProject_1.stopProject)(projectId, userId);
        if (stopResponse && stopResponse.statusCode !== 200) {
            return res.status(stopResponse.statusCode).json({ message: stopResponse.message });
        }
        res.status(200).json({ message: "Projeto parado com sucesso" });
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to stop project",
            error: error.message
        });
    }
};
exports.stopTheProject = stopTheProject;
const getProject = async (req, res) => {
    const { projectId } = req.params;
    const userId = req.userId;
    if (!(0, uuid_1.validate)(projectId) || !(0, uuid_1.validate)(userId)) {
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
                workspaceId: project.workspaceId
            }
        });
        let paid = false;
        const now = new Date();
        if (project.date_expire && project.date_expire > now) {
            paid = true;
        }
        if (!userWorkspace) {
            return res.status(403).json({ message: "Você não tem acesso a este projeto" });
        }
        return res.status(200).json({ ...project, paid: paid });
    }
    catch (error) {
        return res.status(500).json({ message: "erro ao buscar projeto" });
    }
};
exports.getProject = getProject;
const getMyProjects = async (req, res) => {
    const userId = req.userId; // Supondo que o ID do usuário logado esteja disponível em req.userId
    const workspaceId = req.params.workspaceId;
    if (!(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    if (!(0, uuid_1.validate)(workspaceId)) {
        return res.status(400).json({ message: "ID do workspace inválido" });
    }
    const userWorkspace = await prisma.user_workspace.findFirst({
        where: {
            userId,
            workspaceId
        }
    });
    if (!userWorkspace) {
        return res.status(403).json({ message: "Você não tem acesso a este workspace" });
    }
    try {
        const projects = await prisma.project.findMany({
            where: { userId, workspaceId },
        });
        const projectsWithPaymentStatus = projects.map(project => {
            let paid = false;
            const now = new Date();
            if (project.date_expire && project.date_expire > now) {
                paid = true;
            }
            return { ...project, paid };
        });
        res.status(200).json(projectsWithPaymentStatus);
    }
    catch (error) {
        res.status(500).json({ message: "Falha ao recuperar projetos" });
    }
};
exports.getMyProjects = getMyProjects;
const updateProject = async (req, res) => {
    const { projectId } = req.params;
    const { name, description, default_plan, environments } = req.body;
    const userId = req.userId;
    if (!(0, uuid_1.validate)(projectId) || !(0, uuid_1.validate)(userId)) {
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
                workspaceId: project.workspaceId,
            }
        });
        if (!userWorkspace || userWorkspace.role !== 'master') {
            return res.status(403).json({ message: "Você não tem acesso a este projeto" });
        }
        if (default_plan) {
            const existPlan = await prisma.plan.findFirst({
                where: {
                    name: default_plan
                }
            });
            if (!existPlan) {
                return res.status(400).json({ message: "O plano escolhido não está disponível, por favor escolha outro" });
            }
        }
        const updatedProject = await prisma.project.update({
            where: { id: projectId },
            data: {
                name: name || project.name,
                description: description || project.description,
                default_plan: default_plan || project.default_plan,
                environments: environments || project.environments,
            },
        });
        res.status(200).json(updatedProject);
    }
    catch (error) {
        res.status(500).json({ error: "Falha ao atualizar projeto" });
    }
};
exports.updateProject = updateProject;
const deleteProject = async (req, res) => {
    const { projectId } = req.params;
    const userId = req.userId;
    if (!(0, uuid_1.validate)(projectId) || !(0, uuid_1.validate)(userId)) {
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
                workspaceId: project.workspaceId
            }
        });
        if (!userWorkspace || userWorkspace.role !== 'master') {
            return res.status(403).json({ message: "Você não tem acesso a este projeto" });
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
    }
    catch (error) {
        res.status(500).json({
            message: "Falha ao deletar projeto",
            error: error.message
        });
    }
};
exports.deleteProject = deleteProject;
