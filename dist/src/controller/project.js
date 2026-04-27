"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProject = exports.updateProject = exports.getAllProjects = exports.getMyProjects = exports.getProject = exports.stopTheProject = exports.runTheProject = exports.createProject = void 0;
const uuid_1 = require("uuid");
const domain_1 = require("../modify/domain");
const stopProject_1 = require("../services/stopProject");
const runProject_1 = require("../services/runProject");
const to_string_1 = require("../utils/to_string");
const prisma_1 = __importDefault(require("../lib/prisma"));
const project_1 = require("../services/project");
const user_1 = require("../services/user");
const github_1 = require("../services/github");
const project_2 = require("../utils/project");
const github_2 = require("../utils/github");
const crypt_1 = require("../utils/crypt");
// {{Create projecto}}
const createProject = async (req, res) => {
    const { name, description, branch, port, repo_url, environments, default_plan, default_type_payment, period_duration, } = req.body;
    const userId = req.userId;
    if (!(0, uuid_1.validate)(userId) || !userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const inputResult = (0, project_1.validateUserInput)(port, period_duration);
    if (!inputResult.valid) {
        return res
            .status(inputResult.status)
            .json({ message: inputResult.message });
    }
    const existThisProjectName = await prisma_1.default.project.findFirst({
        where: {
            name: name,
            userId: userId,
        },
    });
    if (existThisProjectName) {
        return res.status(400).json({
            message: "Você já tem um projeto com esse nome, escolha outro nome para o projeto",
        });
    }
    if (!name) {
        return res.status(400).json({ message: "O nome do projeto é obrigatório" });
    }
    try {
        const existUser = await (0, user_1.fetchUserById)(userId);
        if (!existUser)
            return res.status(404).json({ message: "Usuário não encontrado" });
        const githubCheck = (0, project_1.assertGithubLinked)(existUser);
        if (!githubCheck.linked)
            return res.status(400).json({ message: githubCheck.message });
        const existPlan = await prisma_1.default.plan.findFirst({
            where: { name: default_plan },
        });
        if (!existPlan)
            return res.status(400).json({
                message: "O plano escolhido não está disponível, por favor escolha outro",
            });
        if (existPlan.duration < 30 && period_duration && period_duration > 1) {
            return res.status(400).json({
                message: "O plano escolhido não suporta a duração selecionada, por favor escolha outro plano ou ajuste a duração",
            });
        }
        const subdomain = await (0, domain_1.generateUniqueSubdomain)(name);
        if (!subdomain)
            return res
                .status(500)
                .json({ message: "Não foi possível gerar um subdomínio único" });
        if (!existUser.github_token)
            return res
                .status(400)
                .json({ message: "Token do GitHub não encontrado" });
        const token = (0, github_1.decryptGithubToken)(existUser.github_token);
        if (!token)
            return res
                .status(500)
                .json({ message: "Erro ao descriptografar token do GitHub" });
        try {
            await (0, github_1.validateGithubRepo)(repo_url, token);
        }
        catch (error) {
            return res.status(400).json({
                message: "Erro ao verificar o repositório: " + error.message,
            });
        }
        await (0, github_1.verifyGithubSession)(token);
        const days = (0, project_2.computeProjectDays)(existPlan.duration, default_type_payment, period_duration);
        const amount = (0, project_2.computeProjectAmount)(existPlan.price, default_type_payment, period_duration);
        const base_domain = process.env.BASE_DOMAIN;
        if (!base_domain) {
            return res.status(500).json({ message: "Base domain não configurado" });
        }
        const project = await prisma_1.default.project.create({
            data: {
                name,
                description,
                branch,
                repo_url,
                default_plan: existPlan.name,
                default_type_payment: default_type_payment || "monthly",
                port: `${port}`,
                userId: existUser.id,
                subdomain: subdomain,
                domain: `https://${subdomain}.${base_domain}`,
                days,
                amount_to_pay: amount,
            },
        });
        const upserts = environments.map(({ key, value }) => prisma_1.default.environment.upsert({
            where: { projectId_key: { projectId: project.id, key } },
            update: { value: (0, crypt_1.encryptEnv)(value) },
            create: { projectId: project.id, key, value: (0, crypt_1.encryptEnv)(value) },
        }));
        await prisma_1.default.$transaction(upserts);
        await (0, user_1.createMember)(existUser.id, project.id);
        const deployDir = process.env.DEPLOY_DIR;
        const targetPath = `${deployDir}/${existUser.username}/${project.subdomain}`;
        if (!project.path) {
            await prisma_1.default.project.update({
                where: { id: project.id },
                data: { path: (0, crypt_1.encryptEnv)(targetPath) },
            });
        }
        (0, github_1.cloneRepository)((0, github_1.buildCloneUrl)(project.repo_url, token), targetPath, project.branch, project.id);
        return res.status(201).json({ ...project, paid: false });
    }
    catch (error) {
        return res.status(500).json({
            message: "Failed to create project",
            error: error.message,
        });
    }
};
exports.createProject = createProject;
const runTheProject = async (req, res) => {
    const projectId = (0, to_string_1.q)(req.params.projectId);
    const userId = req.userId;
    if (!(0, uuid_1.validate)(projectId) || !(0, uuid_1.validate)(userId)) {
        return res.status(400).json({ message: "ID inválido" });
    }
    const existProject = await prisma_1.default.project.findFirst({
        where: { id: projectId },
    });
    if (!existProject) {
        return res.status(404).json({ message: "Projeto não encontrado" });
    }
    const existUser = await prisma_1.default.user.findUnique({
        where: { id: userId },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const userWorkspace = await prisma_1.default.user_workspace.findFirst({
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
        const runResponse = await (0, runProject_1.runProject)(projectId, userId);
        await prisma_1.default.project.update({
            where: { id: projectId },
            data: { repo_saved: true },
        });
        if (runResponse) {
            return res
                .status(runResponse.statusCode)
                .json({ message: runResponse.message });
        }
        res.status(400).json({ message: "Falha ao executar o projeto" });
    }
    catch (error) {
        res.status(400).json({
            message: "Falha ao executar o projeto",
            error: error.message,
        });
    }
};
exports.runTheProject = runTheProject;
const stopTheProject = async (req, res) => {
    const projectId = (0, to_string_1.q)(req.params.projectId);
    const userId = req.userId;
    if (!(0, uuid_1.validate)(projectId) || !(0, uuid_1.validate)(userId)) {
        return res.status(400).json({ message: "ID inválido" });
    }
    try {
        const stopResponse = await (0, stopProject_1.stopProject)(projectId, userId);
        if (stopResponse && stopResponse.statusCode !== 200) {
            return res
                .status(stopResponse.statusCode)
                .json({ message: stopResponse.message });
        }
        res.status(200).json({ message: "Projeto parado com sucesso" });
    }
    catch (error) {
        res.status(500).json({
            message: "Failed to stop project",
            error: error.message,
        });
    }
};
exports.stopTheProject = stopTheProject;
const getProject = async (req, res) => {
    const projectId = (0, to_string_1.q)(req.params.projectId);
    const userId = req.userId;
    if (!(0, uuid_1.validate)(projectId) || !(0, uuid_1.validate)(userId)) {
        return res.status(400).json({ message: "ID inválido" });
    }
    const existUser = await prisma_1.default.user.findUnique({
        where: { id: userId },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    try {
        // ✅ Busca projeto já com todos os relacionamentos necessários
        const project = await prisma_1.default.project.findUnique({
            where: { id: projectId },
            include: {
                user_workspace: {
                    where: { userId },
                    take: 1,
                },
                deploy: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
        });
        if (!project) {
            return res.status(404).json({ message: "Projeto não encontrado" });
        }
        // ✅ Autorização verificada imediatamente, antes de qualquer outro processamento
        if (project.user_workspace.length === 0) {
            return res
                .status(403)
                .json({ message: "Você não tem acesso a este projeto" });
        }
        // ✅ Lógica de negócio só roda após confirmação de acesso
        const now = new Date();
        const paid = !!(project.date_expire && project.date_expire > now) || false;
        const lastCommit = await (0, github_2.getLastCommitFromBranch)(project.repo_url, project.branch, existUser.github_token);
        const deploy = {
            commit_msg: lastCommit.message || "unknown",
            commit_branch: project.branch,
            commit_author: lastCommit.author || "unknown",
            status: project.deploy[0]?.status || "unknown",
            commit_avatar_url: lastCommit.avatar_url || null,
        };
        return res.status(200).json({
            ...project,
            paid,
            deploy,
        });
    }
    catch (error) {
        // ✅ Erro real registrado
        console.error("[getProject]", error);
        return res.status(500).json({ message: "Erro ao buscar projeto" });
    }
};
exports.getProject = getProject;
const getMyProjects = async (req, res) => {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const per_page = parseInt(req.query.per_page) || 10;
    const name = req.query.name;
    if (!(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    const existUser = await prisma_1.default.user.findUnique({
        where: { id: userId },
    });
    if (!existUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
    }
    // ✅ Where centralizado — sem repetição, sem risco de divergência
    const where = {
        userId,
        name: name ? { contains: name, mode: "insensitive" } : undefined,
    };
    try {
        // ✅ Busca projetos e total em paralelo — sem duplicar lógica
        const [projects, totalProjects] = await Promise.all([
            prisma_1.default.project.findMany({
                where,
                include: {
                    deploy: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                    },
                },
                skip: (page - 1) * per_page,
                take: per_page,
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.default.project.count({ where }),
        ]);
        const now = new Date();
        const projectsWithPaymentStatus = await Promise.all(projects.map(async (project) => {
            const lastCommit = await (0, github_2.getLastCommitFromBranch)(project.repo_url, project.branch, existUser.github_token);
            const deploy = {
                commit_msg: lastCommit.message || "unknown",
                commit_branch: project.branch,
                commit_author: lastCommit.author || "unknown",
                status: project.deploy[0]?.status || "unknown",
                commit_avatar_url: lastCommit.avatar_url || null,
            };
            return {
                ...project,
                paid: !!(project.date_expire && project.date_expire > now),
                deploy: deploy,
            };
        }));
        res.status(200).json({
            data: projectsWithPaymentStatus,
            meta: {
                page,
                per_page,
                total_pages: Math.ceil(totalProjects / per_page),
            },
        });
    }
    catch (error) {
        // ✅ Log do erro real preservado
        console.error("[getMyProjects]", error);
        res.status(500).json({ message: "Falha ao recuperar projetos" });
    }
};
exports.getMyProjects = getMyProjects;
const getAllProjects = async (req, res) => {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.per_page) || 10;
    const skip = (page - 1) * limit;
    const name = req.query.name;
    if (!userId || !(0, uuid_1.validate)(userId)) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }
    try {
        const existUser = await prisma_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!existUser) {
            return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const where = {
            userId,
            name: name ? { contains: name, mode: "insensitive" } : undefined,
        };
        const [projects, total] = await Promise.all([
            prisma_1.default.project.findMany({
                where,
                include: {
                    deploy: {
                        orderBy: { createdAt: "desc" },
                        take: 1,
                    },
                },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.default.project.count({ where }),
        ]);
        const now = new Date();
        const projectsWithPaymentStatus = await Promise.all(projects.map(async (project) => {
            const lastCommit = await (0, github_2.getLastCommitFromBranch)(project.repo_url, project.branch, existUser.github_token);
            const deploy = {
                commit_msg: lastCommit.message || "unknown",
                commit_branch: project.branch,
                commit_author: lastCommit.author || "unknown",
                status: project.deploy[0]?.status || "unknown",
                commit_avatar_url: lastCommit.avatar_url || null,
            };
            return {
                ...project,
                paid: !!(project.date_expire && project.date_expire > now),
                deploy: deploy,
            };
        }));
        res.status(200).json({
            data: projectsWithPaymentStatus,
            meta: {
                page,
                per_page: limit,
                total_pages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error("[getAllProjects]", error);
        res.status(500).json({ message: "Falha ao recuperar projetos" });
    }
};
exports.getAllProjects = getAllProjects;
const updateProject = async (req, res) => {
    const projectId = (0, to_string_1.q)(req.params.projectId);
    const { name, description, branch, port } = req.body;
    const userId = req.userId;
    if (!(0, uuid_1.validate)(projectId) || !(0, uuid_1.validate)(userId)) {
        return res.status(400).json({ message: "ID inválido" });
    }
    const inputResult = (0, project_1.validateUserInput)(port, undefined);
    if (!inputResult.valid) {
        return res
            .status(inputResult.status)
            .json({ message: inputResult.message });
    }
    try {
        const project = await prisma_1.default.project.findUnique({
            where: { id: projectId },
        });
        if (!project) {
            return res.status(404).json({ message: "Projeto não encontrado" });
        }
        const userWorkspace = await prisma_1.default.user_workspace.findFirst({
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
        const existThisProjectName = await prisma_1.default.project.findFirst({
            where: {
                name: name,
                userId: userId,
                NOT: { id: projectId },
            },
        });
        if (existThisProjectName) {
            return res.status(400).json({
                message: "Você já tem um projeto com esse nome, escolha outro nome para o projeto",
            });
        }
        const updatedProject = await prisma_1.default.project.update({
            where: { id: projectId },
            data: {
                name: name || project.name,
                description: description || project.description,
                port: port || project.port, // carece de logica para validar se a porta é diferente e se é válida, caso seja diferente da porta atual, tem de verificar se a nova porta está disponível
                branch: branch || project.branch, // carece de lógica para verificar se a branch é diferente e se existe no repositório
            },
        });
        if ((branch && branch !== project.branch) ||
            (port && port !== project.port)) {
            await (0, runProject_1.runProject)(projectId, userId);
            await prisma_1.default.project.update({
                where: { id: projectId },
                data: { repo_saved: true },
            });
        }
        res.status(200).json(updatedProject);
    }
    catch (error) {
        res.status(500).json({ error: "Falha ao atualizar projeto" });
    }
};
exports.updateProject = updateProject;
const deleteProject = async (req, res) => {
    const projectId = (0, to_string_1.q)(req.params.projectId);
    const userId = req.userId;
    if (!(0, uuid_1.validate)(projectId) || !(0, uuid_1.validate)(userId)) {
        return res.status(400).json({ message: "Projecto ou utilizador inválido" });
    }
    try {
        const project = await prisma_1.default.project.findFirst({
            where: { id: projectId },
        });
        if (!project) {
            return res.status(404).json({ message: "Projeto não encontrado" });
        }
        const userWorkspace = await prisma_1.default.user_workspace.findFirst({
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
        await prisma_1.default.payment.deleteMany({
            where: { projectId: projectId },
        });
        await prisma_1.default.deploy.deleteMany({
            where: { projectId: projectId },
        });
        await prisma_1.default.project.delete({
            where: { id: projectId },
        });
        res.status(200).json({ message: "Projeto deletado com sucesso" });
    }
    catch (error) {
        res.status(500).json({
            message: "Falha ao deletar projeto",
            error: error.message,
        });
    }
};
exports.deleteProject = deleteProject;
