"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUserById = fetchUserById;
exports.createMember = createMember;
const uuid_1 = require("uuid");
const prisma_1 = __importDefault(require("../lib/prisma"));
async function fetchUserById(userId) {
    if (!(0, uuid_1.validate)(userId) || !userId)
        return null;
    return prisma_1.default.user.findFirst({
        where: {
            OR: [
                { id: (0, uuid_1.validate)(userId) ? userId : undefined },
                { username: userId },
                { email: userId },
            ],
        },
    });
}
async function createMember(userId, projectId) {
    const existUser = await fetchUserById(userId);
    const project = await prisma_1.default.project.findUnique({ where: { id: projectId } });
    if (!existUser || !project) {
        throw new Error("User or project not found");
    }
    await prisma_1.default.user_workspace.create({
        data: {
            userId: existUser.id,
            projectId: project.id,
            role: "master",
        },
    });
}
