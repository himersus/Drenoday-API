
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import express from "express";
import dotenv from 'dotenv';
import router from "./routers/router";
dotenv.config();

const prisma = new PrismaClient();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the Gohost API!');
});


app.use('/api/v1', router);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
}); 