import z from "zod";

export const createProjectSchema = z.object({
    name: z.string("O nome do projeto é obrigatório").min(3, "O nome do projeto deve conter pelo menos 3 caracteres"),
    description: z.string("A descrição do projeto é obrigatória").min(10, "A descrição do projeto deve conter pelo menos 10 caracteres"),
    workspaceId: z.string("O ID do workspace é obrigatório").uuid("O ID do workspace deve ser um UUID"),
    branch : z.string("O nome da branch é obrigatório").min(3, "O nome da branch deve conter pelo menos 3 caracteres"),
    port : z.number("A porta é obrigatória").int("A porta deve ser um número inteiro").positive("A porta deve ser um número positivo"),
    period_duration : z.number("A duração do período é obrigatória").int("A duração do período deve ser um número inteiro").positive("A duração do período deve ser um número positivo"),
    repo_url : z.string("A URL do repositório é obrigatória").url("A URL do repositório deve ser uma URL válida"),
    environments : z.array(z.string()).optional()
});

export const updateProjectSchema = z.object({
    name: z.string("O nome do projeto é obrigatório").min(3, "O nome do projeto deve conter pelo menos 3 caracteres").optional(),
    description: z.string("A descrição do projeto é obrigatória").min(10, "A descrição do projeto deve conter pelo menos 10 caracteres").optional(),
    branch : z.string("O nome da branch é obrigatório").min(3, "O nome da branch deve conter pelo menos 3 caracteres").optional(),
    port : z.number("A porta é obrigatória").int("A porta deve ser um número inteiro").positive("A porta deve ser um número positivo").optional(),
    period_duration : z.number("A duração do período é obrigatória").int("A duração do período deve ser um número inteiro").positive("A duração do período deve ser um número positivo").optional(),
    environments : z.array(z.string()).optional()
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;