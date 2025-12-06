import { Request, Response } from "express";
import jwt from "jsonwebtoken"

export const AuthUser = async (req: Request | any, res: Response, next: Function) => {
    const HeaderAuthorization = req.headers['authorization'];

    if (!HeaderAuthorization) {
        return res.status(401).json({ message: "Token não fornecido" });
    }

    const token = HeaderAuthorization.replace('Bearer ', '');

    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
        req.userId = decoded.id;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token inválido" });
    }
};