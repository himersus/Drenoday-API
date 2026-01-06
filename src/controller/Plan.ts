import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";
import { validate } from "uuid";

const prisma = new PrismaClient();
export async function addPlan(req: Request, res: Response) {
    const { name, description, price, duration, max_projects } = req.body;

    if (!name || !description || !duration) {
        return res.status(400).json({ message: "Todos os campos são obrigatórios" });
    }

    if (price === undefined || price === null || isNaN(price)) {
        return res.status(400).json({ message: "Preço inválido" });
    }
    try {
        const existPlan = await prisma.plan.findFirst({
            where: { name },
        });

        if (existPlan) {
            return res.status(409).json({ message: "Já existe um plano com este nome" });
        }

        const plan = await prisma.plan.create({
            data: {
                name,
                description,
                duration,
                price,
                max_projects: max_projects && max_projects > 0 ? max_projects : 1
            }
        });
        return res.status(201).json(plan);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao criar plano" });
    }

}

export async function getPlans(req: Request, res: Response) {
    try {
        const plans = await prisma.plan.findMany();
        return res.status(200).json(plans);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar planos" });
    }
}

export async function getPlanById(req: Request, res: Response) {
    const { planId } = req.params;
    try {
        const plan = await prisma.plan.findFirst({
            where: {
                OR: [
                    { id: validate(planId) ? planId : undefined },
                    { name: validate(planId) ? undefined : planId }
                ]
            },
        });

        if (!plan) {
            return res.status(404).json({ message: "Plano não encontrado" });
        }

        return res.status(200).json(plan);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar plano" });
    }
}

export async function deletePlan(req: Request, res: Response) {
    const { planId } = req.params;
    try {
        const plan = await prisma.plan.findFirst({
            where: {
                OR: [
                    { id: validate(planId) ? planId : undefined },
                    { name: validate(planId) ? undefined : planId }
                ]
            },
        });

        if (!plan) {
            return res.status(404).json({ message: "Plano não encontrado" });
        }

        await prisma.plan.delete({
            where: {
                id: plan.id
            }
        });

        return res.status(200).json({ message: "Plano deletado com sucesso" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao deletar plano" });
    }
}