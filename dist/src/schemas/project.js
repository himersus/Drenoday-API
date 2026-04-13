"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProjectSchema = exports.createProjectSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.createProjectSchema = zod_1.default.object({
    name: zod_1.default.string("O nome do projeto é obrigatório").min(3, "O nome do projeto deve conter pelo menos 3 caracteres"),
    description: zod_1.default.string("A descrição do projeto é obrigatória").min(10, "A descrição do projeto deve conter pelo menos 10 caracteres"),
    workspaceId: zod_1.default.string("O ID do workspace é obrigatório").uuid("O ID do workspace deve ser um UUID"),
    branch: zod_1.default.string("O nome da branch é obrigatório").min(3, "O nome da branch deve conter pelo menos 3 caracteres"),
    port: zod_1.default.number("A porta é obrigatória").int("A porta deve ser um número inteiro").positive("A porta deve ser um número positivo"),
    repo_url: zod_1.default.string("A URL do repositório é obrigatória").url("A URL do repositório deve ser uma URL válida"),
    environments: zod_1.default.array(zod_1.default.string()).optional()
});
exports.updateProjectSchema = zod_1.default.object({
    name: zod_1.default.string("O nome do projeto é obrigatório").min(3, "O nome do projeto deve conter pelo menos 3 caracteres").optional(),
    description: zod_1.default.string("A descrição do projeto é obrigatória").min(10, "A descrição do projeto deve conter pelo menos 10 caracteres").optional(),
    branch: zod_1.default.string("O nome da branch é obrigatório").min(3, "O nome da branch deve conter pelo menos 3 caracteres").optional(),
    port: zod_1.default.number("A porta é obrigatória").int("A porta deve ser um número inteiro").positive("A porta deve ser um número positivo").optional(),
    environments: zod_1.default.array(zod_1.default.string()).optional()
});
