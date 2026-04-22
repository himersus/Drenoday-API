"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectLogs = collectLogs;
exports.startLogStream = startLogStream;
const index_1 = require("../sockets/index");
const prisma_1 = __importDefault(require("../lib/prisma"));
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
        await prisma_1.default.deploy.update({
            where: { id: deployId },
            data: {
                logs: {
                    push: line
                }
            }
        });
    });
}
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
