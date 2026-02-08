"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startLogStream = exports.collectLogs = void 0;
const index_1 = require("../sockets/index");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const child_process_1 = require("child_process");
function collectLogs(deployId, projectId, logLines) {
    logLines.map(async (line) => {
        if (!line.trim())
            return;
        console.log("[log]", line);
        (0, index_1.sendSocketContent)("deploy_logs", {
            projectId: projectId,
            deployId: deployId,
            status: "running",
            message: line
        });
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
exports.collectLogs = collectLogs;
function startLogStream(deployId, projectId, containerName) {
    if (!containerName || !deployId) {
        console.error("Container name is required to start log stream.");
        return;
    }
    const logs = (0, child_process_1.spawn)("docker", [
        "logs",
        "-f",
        "--tail=50",
        containerName
    ]);
    logs.stdout.on("data", async (data) => {
        const lines = data.toString().split("\n");
        collectLogs(deployId, projectId, lines);
    });
    logs.stderr.on("data", (data) => {
        console.error("[log error]", data.toString());
    });
    logs.on("close", () => {
        console.log(`[logs] stream finalizado para ${containerName}`);
    });
}
exports.startLogStream = startLogStream;
