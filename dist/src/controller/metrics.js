"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVpsMetrics = exports.getMyGeneralMetrics = exports.getServiceMetrics = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const uuid_1 = require("uuid");
const prisma_1 = __importDefault(require("../lib/prisma"));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const dockerExec = async (containerName, command) => {
    const { stdout } = await execFileAsync("docker", [
        "exec",
        containerName,
        ...command,
    ]);
    return stdout.trim();
};
const getContainerUptime = async (containerName) => {
    const { stdout } = await execFileAsync("docker", [
        "inspect",
        "--format",
        "{{.State.StartedAt}}",
        containerName,
    ]);
    const startedAt = new Date(stdout.trim());
    const uptimeSeconds = (Date.now() - startedAt.getTime()) / 1000;
    return uptimeSeconds;
};
const isContainerRunning = async (containerName) => {
    try {
        const { stdout } = await execFileAsync("docker", [
            "inspect",
            "--format",
            "{{.State.Status}}",
            containerName,
        ]);
        return stdout.trim() === "running";
    }
    catch {
        return false; // container não existe — retorna false sem lançar erro
    }
};
const formatUptime = (seconds) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0)
        parts.push(`${d}d`);
    if (h > 0)
        parts.push(`${h}h`);
    if (m > 0)
        parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
};
const getServiceMetrics = async (req, res) => {
    const projectId = req.params.projectId;
    if (!projectId || (0, uuid_1.validate)(projectId) === false) {
        return res.status(400).json({ message: "ID do projeto é obrigatório" });
    }
    const existProject = await prisma_1.default.project.findFirst({
        where: { id: projectId },
    });
    if (!existProject) {
        return res.status(404).json({ message: "Projeto não encontrado" });
    }
    const serviceName = `${existProject.subdomain}-api`; // Supondo que o nome do serviço seja o subdomínio do projeto
    if (!serviceName || !/^[a-zA-Z0-9_-]+$/.test(serviceName)) {
        return res
            .status(400)
            .json({ message: "Nome do serviço inválido ou não informado" });
    }
    const running = await isContainerRunning(serviceName);
    if (!running) {
        return res.status(404).json({
            message: `Serviço '${serviceName}' não encontrado ou não está rodando`,
        });
    }
    try {
        // Verifica se o container existe e está rodando
        const { stdout: containerStatus } = await execFileAsync("docker", [
            "inspect",
            "--format",
            "{{.State.Status}}",
            serviceName,
        ]);
        if (containerStatus.trim() !== "running") {
            return res.status(404).json({
                message: `Serviço '${serviceName}' não encontrado ou não está rodando`,
            });
        }
        // Coleta todas as métricas em paralelo
        const [cpuRaw, memRaw, uptimeRaw, latencyMs] = await Promise.all([
            // CPU via /proc/stat
            dockerExec(serviceName, [
                "awk",
                "NR==1{u=$2+$4; t=$2+$3+$4+$5; print u*100/t}",
                "/proc/stat",
            ]),
            // Memória via /proc/meminfo
            dockerExec(serviceName, [
                "awk",
                "/MemTotal/{t=$2} /MemAvailable/{a=$2} END{u=t-a; print u/1024, t/1024, u*100/t}",
                "/proc/meminfo",
            ]),
            // Uptime via /proc/uptime
            getContainerUptime(serviceName),
            // Latência do exec
            (async () => {
                const start = Date.now();
                await dockerExec(serviceName, ["echo", "ok"]);
                return Date.now() - start;
            })(),
        ]);
        // Processa CPU
        const cpuUsage = parseFloat(parseFloat(cpuRaw).toFixed(2));
        // Processa Memória
        const [usedMB, totalMB, memPercent] = memRaw.split(" ").map(parseFloat);
        // Processa Uptime
        const uptimeSeconds = uptimeRaw;
        return res.status(200).json({
            service: serviceName,
            metrics: {
                cpu: {
                    usage_percent: cpuUsage,
                },
                memory: {
                    used_mb: parseFloat(usedMB.toFixed(2)),
                    total_mb: parseFloat(totalMB.toFixed(2)),
                    usage_percent: parseFloat(memPercent.toFixed(1)),
                },
                uptime: {
                    seconds: uptimeSeconds,
                    human: formatUptime(uptimeSeconds),
                },
                latency: {
                    exec_ms: latencyMs,
                },
            },
            collected_at: new Date().toISOString(),
        });
    }
    catch (error) {
        if (error.message?.includes("No such container") ||
            error.stderr?.includes("No such container")) {
            return res.status(404).json({
                message: `Serviço '${serviceName}' não encontrado`,
            });
        }
        console.error("Erro ao coletar métricas:", error);
        return res
            .status(500)
            .json({ message: "Erro ao coletar métricas do serviço" });
    }
};
exports.getServiceMetrics = getServiceMetrics;
const getMyGeneralMetrics = async (req, res) => {
    const userId = req.userId;
    if (!userId || (0, uuid_1.validate)(userId) === false) {
        return res.status(400).json({ message: "ID do usuário é obrigatório" });
    }
    const projects = await prisma_1.default.project.findMany({
        where: { userId: userId },
        select: {
            id: true,
            subdomain: true,
            payments: true,
            user_workspace: true,
        },
    });
    if (projects.length === 0) {
        return res.status(404).json({ message: "Nenhum projeto encontrado" });
    }
    try {
        // Coleta memória de todos os projetos em paralelo
        const results = await Promise.allSettled(projects.map(async (project) => {
            const containerName = `${project.subdomain}-api`;
            // Verifica se está rodando antes de tentar coletar
            const running = await isContainerRunning(containerName);
            if (!running) {
                return {
                    project_id: project.id,
                    subdomain: project.subdomain,
                    container: containerName,
                    status: "offline",
                    memory: {
                        used_mb: 0,
                        total_mb: 0,
                        usage_percent: 0,
                    },
                };
            }
            const memRaw = await dockerExec(containerName, [
                "awk",
                "/MemTotal/{t=$2} /MemAvailable/{a=$2} END{u=t-a; print u/1024, t/1024, u*100/t}",
                "/proc/meminfo",
            ]);
            const [usedMB, totalMB, percent] = memRaw.split(" ").map(parseFloat);
            return {
                project_id: project.id,
                subdomain: project.subdomain,
                container: containerName,
                status: "online",
                memory: {
                    used_mb: parseFloat(usedMB.toFixed(2)),
                    total_mb: parseFloat(totalMB.toFixed(2)),
                    usage_percent: parseFloat(percent.toFixed(1)),
                },
            };
        }));
        const successful = results
            .filter((r) => r.status === "fulfilled")
            .map((r) => r.value);
        const failed = results
            .filter((r) => r.status === "rejected")
            .map((_, i) => ({
            project_id: projects[i].id,
            subdomain: projects[i].subdomain,
            container: `${projects[i].subdomain}-api`,
        }));
        // Calcula a média geral
        const average_memory = successful.length > 0
            ? {
                used_mb: parseFloat((successful.reduce((acc, p) => acc + p.memory.used_mb, 0) /
                    successful.length).toFixed(2)),
                total_mb: parseFloat((successful.reduce((acc, p) => acc + p.memory.total_mb, 0) /
                    successful.length).toFixed(2)),
                usage_percent: parseFloat((successful.reduce((acc, p) => acc + p.memory.usage_percent, 0) /
                    successful.length).toFixed(1)),
            }
            : null;
        return res.status(200).json({
            average: {
                total_projects: projects.length,
                collected: successful.length,
                average_memory,
                projects: successful,
                ...(failed.length > 0 && { failed: failed }),
                collected_at: new Date().toISOString(),
            },
            services: {
                total: projects.length,
                successful: successful.length,
                failed: failed.length,
                collected_at: new Date().toISOString(),
            },
            payment: {
                total: projects.reduce((acc, p) => acc + p.payments.length, 0),
            },
            members: {
                total: projects.reduce((acc, p) => acc + p.user_workspace.length, 0),
            },
        });
    }
    catch (error) {
        console.error("Erro ao coletar métricas gerais:", error);
        return res.status(500).json({ message: "Erro ao coletar métricas gerais" });
    }
};
exports.getMyGeneralMetrics = getMyGeneralMetrics;
const runCommand = async (command, args) => {
    const { stdout } = await execFileAsync(command, args);
    return stdout.trim();
};
const getVpsMetrics = async (req, res) => {
    try {
        const [memRaw, diskRaw, uptimeRaw, loadRaw] = await Promise.all([
            // Memória
            runCommand("awk", [
                "/MemTotal/{t=$2} /MemAvailable/{a=$2} END{u=t-a; print u/1024, t/1024, u*100/t}",
                "/proc/meminfo",
            ]),
            // Disco
            runCommand("df", ["-h", "--output=used,size,pcent", "/"]),
            // Uptime
            runCommand("cat", ["/proc/uptime"]),
            // Load average
            runCommand("cat", ["/proc/loadavg"]),
        ]);
        // Processa Memória
        const [usedMB, totalMB, memPercent] = memRaw.split(" ").map(parseFloat);
        // Processa Disco
        const diskLines = diskRaw.trim().split("\n");
        const diskValues = diskLines[diskLines.length - 1].trim().split(/\s+/);
        const diskUsed = diskValues[0];
        const diskTotal = diskValues[1];
        const diskPercent = parseFloat(diskValues[2].replace("%", ""));
        // Processa Uptime
        const uptimeSeconds = parseFloat(uptimeRaw.split(" ")[0]);
        // Processa Load Average (1m, 5m, 15m)
        const [load1, load5, load15] = loadRaw.split(" ").map(parseFloat);
        return res.status(200).json({
            memory: {
                used_mb: parseFloat(usedMB.toFixed(2)),
                total_mb: parseFloat(totalMB.toFixed(2)),
                usage_percent: parseFloat(memPercent.toFixed(1)),
            },
            disk: {
                used: diskUsed,
                total: diskTotal,
                usage_percent: diskPercent,
            },
            uptime: {
                seconds: uptimeSeconds,
                human: formatUptime(uptimeSeconds),
            },
            load_average: {
                "1m": load1,
                "5m": load5,
                "15m": load15,
            },
            collected_at: new Date().toISOString(),
        });
    }
    catch (error) {
        console.error("Erro ao coletar métricas da VPS:", error);
        return res.status(500).json({ message: "Erro ao coletar métricas da VPS" });
    }
};
exports.getVpsMetrics = getVpsMetrics;
