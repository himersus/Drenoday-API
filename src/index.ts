
import 'dotenv/config';
import express from "express";
import dotenv from 'dotenv';
import router from "./routers/apiRouter";
import session from "express-session";
import passport from "passport";
import cors from "cors";
import "./auth/github";
import "./auth/googleAuth";

// configurar o socket
import { createServer } from "http";
import { initSocket } from "./sockets/index";

const port = process.env.PORT || 3000;
const app = express();
dotenv.config();

// Cria servidor HTTP a partir do Express
const httpServer = createServer(app);

// Inicializa Socket.IO
initSocket(httpServer);

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

httpServer.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});