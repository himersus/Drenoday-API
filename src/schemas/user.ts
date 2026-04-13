import z from "zod";

export const createUserSchema = z.object({
    name: z.string("O nome é obrigatório").min(3, "O nome deve conter pelo menos 3 caracteres"),
    email: z.string("O email é obrigatório").email("Email inválido"),
    password: z.string("A senha é obrigatória").min(6, "A senha deve conter pelo menos 6 caracteres"),
});

export const updateUserSchema = z.object({
    name: z.string("O nome é obrigatório").min(3, "O nome deve conter pelo menos 3 caracteres").optional(),
    email: z.string("O email é obrigatório").email("Email inválido").optional(),
    password: z.string("A senha é obrigatória").min(6, "A senha deve conter pelo menos 6 caracteres").optional(),
});

export const loginUserSchema = z.object({
    username: z.string("O nome de usuário é obrigatório").min(3, "O nome de usuário deve conter pelo menos 3 caracteres"),
    password: z.string("A senha é obrigatória").min(6, "A senha deve conter pelo menos 6 caracteres"),
});

export const sendCodeVerificationSchema = z.object({
    email: z.string("O email é obrigatório").email("Email inválido"),
});

export const verifyCodeSchema = z.object({
    email: z.string("O email é obrigatório").email("Email inválido"),
    code: z.string("O código de verificação é obrigatório").length(6, "O código de verificação deve conter exatamente 6 caracteres"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;
export type SendCodeVerificationInput = z.infer<typeof sendCodeVerificationSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;