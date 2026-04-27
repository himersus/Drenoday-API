import z from "zod";
import { typePayment } from "@prisma/client";

export const createProjectSchema = z.object({
  name: z
    .string("O nome do projeto é obrigatório")
    .min(3, "O nome do projeto deve conter pelo menos 3 caracteres"),
  description: z
    .string("A descrição do projeto é obrigatória")
    .min(10, "A descrição do projeto deve conter pelo menos 10 caracteres"),
  branch: z
    .string("O nome da branch é obrigatório")
    .min(3, "O nome da branch deve conter pelo menos 3 caracteres"),
  port: z
    .number("A porta é obrigatória")
    .int("A porta deve ser um número inteiro")
    .positive("A porta deve ser um número positivo"),
  period_duration: z
    .number("A duração do período é obrigatória e deve ser um número")
    .int("A duração do período deve ser um número inteiro")
    .positive("A duração do período deve ser um número positivo")
    .optional(),
  repo_url: z
    .string("A URL do repositório é obrigatória")
    .url("A URL do repositório deve ser uma URL válida"),
  environments: z.array(z.object({ key: z.string("A chave do ambiente é obrigatória"), value: z.string("O valor do ambiente é obrigatório e deve ser uma string") })).optional(),
  default_plan: z
    .string("O plano padrão é obrigatório")
    .min(3, "O plano padrão deve conter pelo menos 3 caracteres"),
  default_type_payment: z
    .enum(typePayment, "O tipo de pagamento deve ser mensal ou anual")
    .optional(),
});

export const updateProjectSchema = z.object({
  name: z
    .string("O nome do projeto é obrigatório")
    .min(3, "O nome do projeto deve conter pelo menos 3 caracteres")
    .optional(),
  description: z
    .string("A descrição do projeto é obrigatória")
    .min(10, "A descrição do projeto deve conter pelo menos 10 caracteres")
    .optional(),
  branch: z
    .string("O nome da branch é obrigatório")
    .min(3, "O nome da branch deve conter pelo menos 3 caracteres")
    .optional(),
  port: z
    .number("A porta é obrigatória")
    .int("A porta deve ser um número inteiro")
    .positive("A porta deve ser um número positivo")
    .optional(),
  period_duration: z
    .number("A duração do período é obrigatória e deve ser um número (ex: 2)")
    .int("A duração do período deve ser um número inteiro")
    .positive("A duração do período deve ser um número positivo")
    .optional(),
  environments: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
});

export const saveEnvSchema = z.object({
  environments: z.array(
    z.object({
      key: z.string("A chave do ambiente é obrigatória"),
      value: z.string("O valor do ambiente é obrigatório e deve ser uma string"),
    })
  ),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type SaveEnvInput = z.infer<typeof saveEnvSchema>;
