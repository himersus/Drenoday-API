// src/middlewares/validate.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export const validate =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
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
