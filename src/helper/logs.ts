
import { sendSocketContent } from "../sockets/index"
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import { spawn } from "child_process";

export function startLogStream(deployId: string, containerName: string) {
  const logs = spawn("docker", [
    "logs",
    "-f",
    "--tail=50",
    containerName
  ]);

  logs.stdout.on("data", async (data: Buffer) => {
    const lines = data.toString().split("\n");

    lines.map(async (line) => {
      if (!line.trim()) return;

      console.log("[log]", line);

      sendSocketContent("logs", {
        deployId: deployId,
        line: line
      })

      // salvar no banco
      await prisma.deploy.update({
        where: { id: deployId },
        data: {
          logs: {
            push: line
          }
        }
      });
    });
  }
  );

  logs.stderr.on("data", (data: Buffer) => {
    console.error("[log error]", data.toString());
  });

  logs.on("close", () => {
    console.log(`[logs] stream finalizado para ${containerName}`);
  });
}
