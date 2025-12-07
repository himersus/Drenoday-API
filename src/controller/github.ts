
import axios from "axios";
import { Request, Response } from "express";

export const getUserRepos = async (req: Request, res: Response) => {
    const user = req.user as any;
    const token = req.params.token_git;

    if (!token) {
        return res.status(401).json({ message: "Token não fornecido" });
    }

    try {
        const response = await axios.get("https://api.github.com/user/repos", {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github+json"
            }
        });

        if (response.status !== 200) {
            return res.status(response.status).json({ message: "Erro ao buscar repositórios" });
        }

        return res.json(response.data);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Erro ao buscar repositórios" });
    }
};


