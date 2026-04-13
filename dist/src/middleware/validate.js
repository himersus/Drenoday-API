"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    // pegar o primeiro erro do zod e retornar a mensagem
    if (!result.success) {
        const firstError = result.error.issues[0];
        return res.status(400).json({
            message: firstError.message,
        });
    }
    req.body = result.data;
    next();
};
exports.validate = validate;
