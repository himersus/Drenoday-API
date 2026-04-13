"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeMemberSchema = exports.addMemberSchema = exports.updateWorkspaceSchema = exports.createWorkspaceSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.createWorkspaceSchema = zod_1.default.object({
    name: zod_1.default.string("O nome do workspace é obrigatório").min(3, "O nome do workspace deve conter pelo menos 3 caracteres"),
});
exports.updateWorkspaceSchema = zod_1.default.object({
    name: zod_1.default.string("O nome do workspace é obrigatório").min(3, "O nome do workspace deve conter pelo menos 3 caracteres").optional(),
});
exports.addMemberSchema = zod_1.default.object({
    username: zod_1.default.string("O nome de usuário do membro é obrigatório"),
    workspaceId: zod_1.default.string("O ID do workspace é obrigatório"),
    role: zod_1.default.enum(["master", "admin", "member"], "O papel do membro é obrigatório e deve ser 'master', 'admin' ou 'member'"),
});
exports.removeMemberSchema = zod_1.default.object({
    username: zod_1.default.string("O nome de usuário do membro é obrigatório"),
    workspaceId: zod_1.default.string("O ID do workspace é obrigatório"),
});
