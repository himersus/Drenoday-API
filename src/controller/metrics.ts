import { exec } from "child_process";
import { promisify } from "util";
import { Request, Response } from "express";
import prisma from "../lib/prisma";

const execAsync = promisify(exec);

// Helper para executar comandos dentro do container
const dockerExec = async (containerName: string, command: string): Promise<string> => {
  const { stdout } = await execAsync(`docker exec ${containerName} ${command}`);
  return stdout.trim();
};

export const getServiceMetrics = async (req: Request | any, res: Response) => {
  const projectId = req.params.projectId as string;

  if (!projectId) {
    return res.status(400).json({ message: "ID do projeto é obrigatório" });
  }

  const existProject = await prisma.project.findFirst({
    where: { id: projectId },
  });

  if (!existProject) {
    return res.status(404).json({ message: "Projeto não encontrado" });
  }

  const serviceName = `${existProject.subdomain}-api`;

  try {
    // Verifica se o container existe e está rodando
    const { stdout: containerCheck } = await execAsync(
      `docker inspect --format='{{.State.Status}}' ${serviceName} 2>/dev/null`
    );

    if (containerCheck.trim() !== "running") {
      return res.status(404).json({ message: `Serviço '${serviceName}' não encontrado ou não está rodando` });
    }

    // Coleta todas as métricas em paralelo
    const [cpuRaw, memRaw, uptimeRaw, latencyRaw] = await Promise.all([
      // CPU: usa /proc/stat para calcular uso real
      dockerExec(
        serviceName,
        `sh -c "cat /proc/stat | grep '^cpu ' | awk '{usage=($2+$4)*100/($2+$3+$4+$5)} END {print usage}'"`,
      ),

      // Memória: /proc/meminfo
      dockerExec(
        serviceName,
        `sh -c "awk '/MemTotal/{total=$2} /MemAvailable/{avail=$2} END {used=total-avail; printf \\"%.2f %.2f %.1f\\", used/1024, total/1024, (used/total)*100}' /proc/meminfo"`,
      ),

      // Uptime: /proc/uptime
      dockerExec(serviceName, `cat /proc/uptime`),

      // Latência: tempo de resposta de um comando simples (em ms)
      (async () => {
        const start = Date.now();
        await dockerExec(serviceName, "echo ok");
        return (Date.now() - start).toString();
      })(),
    ]);

    // Processa CPU
    const cpuUsage = parseFloat(cpuRaw).toFixed(2);

    // Processa Memória
    const [memUsedMB, memTotalMB, memPercent] = memRaw.split(" ");

    // Processa Uptime
    const uptimeSeconds = parseFloat(uptimeRaw.split(" ")[0]);
    const uptime = formatUptime(uptimeSeconds);

    // Processa Latência
    const latencyMs = parseInt(latencyRaw);

    return res.status(200).json({
      service: serviceName,
      metrics: {
        cpu: {
          usage_percent: parseFloat(cpuUsage),
        },
        memory: {
          used_mb: parseFloat(memUsedMB),
          total_mb: parseFloat(memTotalMB),
          usage_percent: parseFloat(memPercent),
        },
        uptime: {
          seconds: uptimeSeconds,
          human: uptime,
        },
        latency: {
          exec_ms: latencyMs,
        },
      },
      collected_at: new Date().toISOString(),
    });
  } catch (error: any) {
    // Container não existe
    if (error.message?.includes("No such container")) {
      return res.status(404).json({ message: `Serviço '${serviceName}' não encontrado` });
    }

    console.error(error);
    return res.status(500).json({ message: "Erro ao coletar métricas do serviço" });
  }
};

// Formata segundos em string legível
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