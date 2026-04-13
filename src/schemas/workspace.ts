import z from "zod";

export const createWorkspaceSchema = z.object({
    name: z.string("O nome do workspace é obrigatório").min(3, "O nome do workspace deve conter pelo menos 3 caracteres"),
});

export const updateWorkspaceSchema = z.object({
    name: z.string("O nome do workspace é obrigatório").min(3, "O nome do workspace deve conter pelo menos 3 caracteres").optional(),
});

export const addMemberSchema = z.object({
    username: z.string("O nome de usuário do membro é obrigatório"),
    workspaceId: z.string("O ID do workspace é obrigatório"),
    role: z.enum(["master", "admin", "member"], "O papel do membro é obrigatório e deve ser 'master', 'admin' ou 'member'"),
});

export const removeMemberSchema = z.object({
    username: z.string("O nome de usuário do membro é obrigatório"),
    workspaceId: z.string("O ID do workspace é obrigatório"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;