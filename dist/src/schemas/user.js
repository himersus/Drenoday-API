"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCodeSchema = exports.sendCodeVerificationSchema = exports.loginUserSchema = exports.updateUserSchema = exports.createUserSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.createUserSchema = zod_1.default.object({
    name: zod_1.default.string("O nome é obrigatório").min(3, "O nome deve conter pelo menos 3 caracteres"),
    email: zod_1.default.string("O email é obrigatório").email("Email inválido"),
    password: zod_1.default.string("A senha é obrigatória").min(6, "A senha deve conter pelo menos 6 caracteres"),
});
exports.updateUserSchema = zod_1.default.object({
    name: zod_1.default.string("O nome é obrigatório").min(3, "O nome deve conter pelo menos 3 caracteres").optional(),
    email: zod_1.default.string("O email é obrigatório").email("Email inválido").optional(),
    password: zod_1.default.string("A senha é obrigatória").min(6, "A senha deve conter pelo menos 6 caracteres").optional(),
});
exports.loginUserSchema = zod_1.default.object({
    username: zod_1.default.string("O nome de usuário é obrigatório").min(3, "O nome de usuário deve conter pelo menos 3 caracteres"),
    password: zod_1.default.string("A senha é obrigatória").min(6, "A senha deve conter pelo menos 6 caracteres"),
});
exports.sendCodeVerificationSchema = zod_1.default.object({
    email: zod_1.default.string("O email é obrigatório").email("Email inválido"),
});
exports.verifyCodeSchema = zod_1.default.object({
    email: zod_1.default.string("O email é obrigatório").email("Email inválido"),
    code: zod_1.default.string("O código de verificação é obrigatório").length(6, "O código de verificação deve conter exatamente 6 caracteres"),
});
