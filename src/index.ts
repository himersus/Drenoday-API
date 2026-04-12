
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
import cookieParser from 'cookie-parser';

const port = Number(process.env.PORT) || 3000;
const app = express();
dotenv.config();

// Cria servidor HTTP a partir do Express
const httpServer = createServer(app);

// Inicializa Socket.IO
initSocket(httpServer);

app.use(cors({
    origin: [
        "http://localhost:5500",
        "http://localhost:3000",
        "https://drenoday.enor.tech"
    ],
    credentials: true
}));


app.use(express.json());
app.use(cookieParser());
// CONFIGURAR SESSÃO

app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false // muda para true quando tiver HTTPS
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
    res.send('Welcome to drenoday API!');
});

app.get("/cookie", (req, res) => {
  res.json(req.cookies);
});

app.use('/api/v1', router);

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${port}`);
});