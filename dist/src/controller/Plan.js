"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePlan = exports.getPlanById = exports.getPlans = exports.addPlan = void 0;
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const prisma = new client_1.PrismaClient();
async function addPlan(req, res) {
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
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao criar plano" });
    }
}
exports.addPlan = addPlan;
async function getPlans(req, res) {
    try {
        const plans = await prisma.plan.findMany();
        return res.status(200).json(plans);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar planos" });
    }
}
exports.getPlans = getPlans;
async function getPlanById(req, res) {
    const { planId } = req.params;
    try {
        const plan = await prisma.plan.findFirst({
            where: {
                OR: [
                    { id: (0, uuid_1.validate)(planId) ? planId : undefined },
                    { name: (0, uuid_1.validate)(planId) ? undefined : planId }
                ]
            },
        });
        if (!plan) {
            return res.status(404).json({ message: "Plano não encontrado" });
        }
        return res.status(200).json(plan);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar plano" });
    }
}
exports.getPlanById = getPlanById;
async function deletePlan(req, res) {
    const { planId } = req.params;
    try {
        const plan = await prisma.plan.findFirst({
            where: {
                OR: [
                    { id: (0, uuid_1.validate)(planId) ? planId : undefined },
                    { name: (0, uuid_1.validate)(planId) ? undefined : planId }
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
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao deletar plano" });
    }
}
exports.deletePlan = deletePlan;
