"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUserInput = validateUserInput;
exports.assertGithubLinked = assertGithubLinked;
function validateUserInput(port, period_duration) {
    const portNumber = Number(port);
    if (!port || !portNumber) {
        return {
            valid: false,
            status: 400,
            message: "Porta é obrigatório e deve ser um número valido",
        };
    }
    if (portNumber < 1024 || portNumber > 65535) {
        return {
            valid: false,
            status: 400,
            message: "Porta deve estar entre 1024 e 65535",
        };
    }
    if (period_duration !== undefined &&
        (!Number.isInteger(period_duration) || period_duration <= 0)) {
        return {
            valid: false,
            status: 400,
            message: "Duração do período deve ser um número inteiro positivo",
        };
    }
    return { valid: true, portNumber };
}
function assertGithubLinked(user) {
    if (!user.github_id || !user.github_token || !user.github_username) {
        return {
            linked: false,
            message: "Informações do GitHub são obrigatórias, tente sincronizar com o github",
        };
    }
    return { linked: true };
}
