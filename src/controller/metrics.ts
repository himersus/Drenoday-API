import { Request, Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { validate } from "uuid";
import prisma from "../lib/prisma";

const execFileAsync = promisify(execFile);

const dockerExec = async (containerName: string, command: string[]): Promise<string> => {
  const { stdout } = await execFileAsync("docker", ["exec", containerName, ...command]);
  return stdout.trim();
};

const formatUptime = (seconds: number): string => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);

  return parts.join(" ");
};

export const getServiceMetrics = async (req: Request | any, res: Response) => {
  const projectId = req.params.projectId;
  const userId = req.user.id;

  if (!projectId || validate(projectId) === false) {
    return res.status(400).json({ message: "ID do projeto é obrigatório" });
  }

  const existProject = await prisma.project.findFirst({
    where: { id: projectId },
  });

  if (!existProject) {
    return res.status(404).json({ message: "Projeto não encontrado" });
  }

  
    const serviceName = `${existProject.subdomain}-api`; // Supondo que o nome do serviço seja o subdomínio do projeto

  if (!serviceName || !/^[a-zA-Z0-9_-]+$/.test(serviceName)) {
    return res.status(400).json({ message: "Nome do serviço inválido ou não informado" });
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
      dockerExec(serviceName, ["cat", "/proc/uptime"]),

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
    const uptimeSeconds = parseFloat(uptimeRaw.split(" ")[0]);

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
  } catch (error: any) {
    if (error.message?.includes("No such container") || error.stderr?.includes("No such container")) {
      return res.status(404).json({
        message: `Serviço '${serviceName}' não encontrado`,
      });
    }

    console.error("Erro ao coletar métricas:", error);
    return res.status(500).json({ message: "Erro ao coletar métricas do serviço" });
  }
};