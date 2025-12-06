
import express from "express";
import dotenv from 'dotenv';
import { PrismaClient } from "@prisma/client";


dotenv.config();
const prisma = new PrismaClient();

const app = express();
const port = process.env.PORT || 3000;



app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the Gohost API!');
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
}); 