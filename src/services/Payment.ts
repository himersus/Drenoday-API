import { PrismaClient, typePayment } from "@prisma/client";
import { validate } from "uuid";
import axios from "axios"
import { getAppyPayToken } from "./generateToken";

const prisma = new PrismaClient();

type responseService = {
    message : string,
    code : number,
    data : any | null | undefined
}

export const verificationPayment = async (userId: string, projectId: string, plan_name: string) => {
    if (!userId || !validate(userId)) {
        return {
            message: "Usuário não autenticado",
            code: 401
        }
    }

    const existUser = await prisma.user.findUnique({
        where: { id: userId }
    });

    if (!existUser) {
        return {
            message: "Usuário não encontrado",
            code: 404
        };
    }

    if (validate(!projectId)) {
        return {
            message: "ID do projeto inválido",
            code: 400
        };
    }

    const existProject = await prisma.project.findUnique({
        where: { id: projectId }
    });

    if (!existProject) {
        return {
            message: "Projeto não encontrado",
            code: 404
        };
    }

    if (!plan_name || typeof plan_name !== 'string') {
        return {
            message: "Nome do plano inválido",
            code: 400
        };
    }

    const existPlan = await prisma.plan.findUnique({
        where: { name: plan_name }
    });

    if (!existPlan) {
        return {
            message: "Plano não encontrado",
            code: 404
        };
    }

    let payment_form = '';
    if (existPlan.duration === 30) {
        payment_form = 'monthly';
    } else if (existPlan.duration === 365) {
        payment_form = 'yearly';
    } else {
        payment_form = 'daily';
    }

    const payment_form_str = payment_form as typePayment || 'monthly';

    if (payment_form_str !== 'monthly' && payment_form_str !== 'yearly' && payment_form_str !== 'daily') {
        return {
            message: "Forma de pagamento inválida",
            code: 400
        }
    }

    let amount = existPlan.price;
    let time_in_day: number | undefined = undefined;
    if (payment_form_str === 'yearly') {
        amount = existPlan.price * 12 - (existPlan.price * 0.5);
        time_in_day = existPlan.duration * 12;
    } else if (payment_form_str === 'daily') {
        amount = existPlan.price;
        time_in_day = existPlan.duration;
    }
    else {
        amount = existPlan.price;
        time_in_day = existPlan.duration;
    }

    return {
        message: "Pagamento criado com sucesso",
        code: 200,
        data: {
            type_payment: payment_form_str,
            amount: amount,
            time_in_day: time_in_day,
            plan_id: existPlan.id,
            plan_name: existPlan.name,
            username: existUser.username,
            user_email: existUser.email,
            name: existUser.name
        }
    };
}

export const referenceSendPaymentService = async (merchantId: string, amount: number, description: string) : Promise<responseService> => {
    const token = getAppyPayToken();

    const options = {
        method: 'POST',
        url: 'https://gwy-api.appypay.co.ao/v2.0/charges',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
        },
        data: {
            amount: amount,
            currency: "AOA",
            description: description || "Pagamento DrenoDay",
            merchantTransactionId: merchantId,
            paymentMethod: process.env.PG_PAYMENT_METHOD_ID,
            notify: {
                name: "Justino Soares",
                telephone: "946671828",
                email: "justinocsoares123@gmail.com",
                smsNotification: true,
                emailNotification: true
            }
        }
    };

    try {
        const response = await axios.request(options);
        const data = response.data
        if (data.responseStatus.successful) {
            return {
                message: "A solicitação foi aceita para processamento.",
                code: 200,
                data: data.responseStatus.reference
            }
        }
        return {
            message: "A solicitação foi rejeitada, tente novamente",
            code: 400,
            data : undefined
        }
    } catch (error) {
        return {
            message: "A solicitação foi rejeitada, tente novamente",
            code: 400,
            data : undefined
        }
    }
}
