"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPlan = addPlan;
exports.getPlans = getPlans;
exports.updatePlan = updatePlan;
exports.getPlanById = getPlanById;
exports.deletePlan = deletePlan;
const prisma_1 = __importDefault(require("../lib/prisma"));
const uuid_1 = require("uuid");
const to_string_1 = require("../utils/to_string");
async function addPlan(req, res) {
    const { name, description, price, duration, max_projects, duration_description, features, shortcut } = req.body;
    if (!name || !description || !duration) {
        return res.status(400).json({ message: "Todos os campos são obrigatórios" });
    }
    if (price === undefined || price === null || isNaN(price)) {
        return res.status(400).json({ message: "Preço inválido" });
    }
    try {
        const existPlan = await prisma_1.default.plan.findFirst({
            where: { name },
        });
        if (existPlan) {
            return res.status(409).json({ message: "Já existe um plano com este nome" });
        }
        const plan = await prisma_1.default.plan.create({
            data: {
                name,
                description,
                duration,
                price,
                max_projects: max_projects && max_projects > 0 ? max_projects : 1,
                duration_description: duration_description || '',
                features: features || [],
                shortcut: shortcut || ''
            }
        });
        return res.status(201).json(plan);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao criar plano" });
    }
}
async function getPlans(req, res) {
    try {
        const plans = await prisma_1.default.plan.findMany();
        return res.status(200).json(plans);
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar planos" });
    }
}
async function updatePlan(req, res) {
    const planId = (0, to_string_1.q)(req.params.planId);
    const { name, description, price, duration, max_projects, duration_description, features, shortcut } = req.body;
    if (!(0, uuid_1.validate)(planId)) {
        return res.status(400).json({ message: "ID do plano inválido" });
    }
    try {
        const plan = await prisma_1.default.plan.findFirst({
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
        await prisma_1.default.plan.update({
            where: {
                id: plan.id
            },
            data: {
                name: name || plan.name,
                description: description || plan.description,
                price: price !== undefined && price !== null && !isNaN(price) ? price : plan.price,
                duration: duration || plan.duration,
                max_projects: max_projects && max_projects > 0 ? max_projects : plan.max_projects,
                duration_description: duration_description || plan.duration_description,
                features: features || plan.features,
                shortcut: shortcut || plan.shortcut
            },
        });
        return res.status(200).json({ message: "Plano atualizado com sucesso" });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao atualizar plano" });
    }
}
async function getPlanById(req, res) {
    const planId = (0, to_string_1.q)(req.params.planId);
    try {
        const plan = await prisma_1.default.plan.findFirst({
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
async function deletePlan(req, res) {
    const planId = (0, to_string_1.q)(req.params.planId);
    try {
        const plan = await prisma_1.default.plan.findFirst({
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
        await prisma_1.default.plan.delete({
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
