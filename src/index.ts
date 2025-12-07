
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import express from "express";
import dotenv from 'dotenv';
import router from "./routers/router";
import session from "express-session";
import passport from "passport";
import cors from "cors";
import "./auth/github";

dotenv.config();

const prisma = new PrismaClient();

const app = express();
const port = process.env.PORT || 3000;

// CONFIGURAR SESSÃO
app.use(session({ secret: process.env.SESSION_SECRET!, resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

app.use(express.json());

app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.get('/', (req, res) => {
    res.send('Welcome to the Gohost API!');
});


app.use('/api/v1', router);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
}); 