"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePlanSchema = exports.createPlanSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.createPlanSchema = zod_1.default.object({
    name: zod_1.default.string("O nome do plano é obrigatório").min(3, "O nome do plano deve conter pelo menos 3 caracteres"),
    description: zod_1.default.string("A descrição do plano é obrigatória").min(10, "A descrição do plano deve conter pelo menos 10 caracteres"),
    price: zod_1.default.number("O preço do plano é obrigatório").positive("O preço do plano deve ser um número positivo"),
    duration: zod_1.default.number("A duração do plano é obrigatória").int("A duração do plano deve ser um número inteiro").positive("A duração do plano deve ser um número positivo"),
    max_projects: zod_1.default.number("O número máximo de projetos é obrigatório").int("O número máximo de projetos deve ser um número inteiro").positive("O número máximo de projetos deve ser um número positivo"),
});
exports.updatePlanSchema = zod_1.default.object({
    name: zod_1.default.string("O nome do plano é obrigatório").min(3, "O nome do plano deve conter pelo menos 3 caracteres").optional(),
    description: zod_1.default.string("A descrição do plano é obrigatória").min(10, "A descrição do plano deve conter pelo menos 10 caracteres").optional(),
    price: zod_1.default.number("O preço do plano é obrigatório").positive("O preço do plano deve ser um número positivo").optional(),
    duration: zod_1.default.number("A duração do plano é obrigatória").int("A duração do plano deve ser um número inteiro").positive("A duração do plano deve ser um número positivo").optional(),
    max_projects: zod_1.default.number("O número máximo de projetos é obrigatório").int("O número máximo de projetos deve ser um número inteiro").positive("O número máximo de projetos deve ser um número positivo").optional(),
});
