import { DEFAULT_MAX_VERSION } from "node:tls";
import z from "zod";

export const createPlanSchema = z.object({
    name: z.string("O nome do plano é obrigatório").min(3, "O nome do plano deve conter pelo menos 3 caracteres"),
    description: z.string("A descrição do plano é obrigatória").min(10, "A descrição do plano deve conter pelo menos 10 caracteres"),
    price: z.number("O preço do plano é obrigatório").positive("O preço do plano deve ser um número positivo"),
    duration: z.number("A duração do plano é obrigatória").int("A duração do plano deve ser um número inteiro").positive("A duração do plano deve ser um número positivo"),
    max_projects: z.number("O número máximo de projetos é obrigatório").int("O número máximo de projetos deve ser um número inteiro").positive("O número máximo de projetos deve ser um número positivo"),
});

export const updatePlanSchema = z.object({
    name: z.string("O nome do plano é obrigatório").min(3, "O nome do plano deve conter pelo menos 3 caracteres").optional(),
    description: z.string("A descrição do plano é obrigatória").min(10, "A descrição do plano deve conter pelo menos 10 caracteres").optional(),
    price: z.number("O preço do plano é obrigatório").positive("O preço do plano deve ser um número positivo").optional(),
    duration: z.number("A duração do plano é obrigatória").int("A duração do plano deve ser um número inteiro").positive("A duração do plano deve ser um número positivo").optional(),
    max_projects: z.number("O número máximo de projetos é obrigatório").int("O número máximo de projetos deve ser um número inteiro").positive("O número máximo de projetos deve ser um número positivo").optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;