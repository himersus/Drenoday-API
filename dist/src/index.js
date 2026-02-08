"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const apiRouter_1 = __importDefault(require("./routers/apiRouter"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const cors_1 = __importDefault(require("cors"));
require("./auth/github");
require("./auth/googleAuth");
// configurar o socket
const http_1 = require("http");
const index_1 = require("./sockets/index");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const port = process.env.PORT || 3000;
const app = (0, express_1.default)();
dotenv_1.default.config();
// Cria servidor HTTP a partir do Express
const httpServer = (0, http_1.createServer)(app);
// Inicializa Socket.IO
(0, index_1.initSocket)(httpServer);
app.use((0, cors_1.default)({
    origin: [
        "http://localhost:5500",
        "http://localhost:3000",
        "https://drenoday.enor.tech"
    ],
    credentials: true
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// CONFIGURAR SESSÃO
app.use((0, express_session_1.default)({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: true }));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
app.get('/', (req, res) => {
    res.send('Welcome to drenoday API!');
});
app.get("/cookie", (req, res) => {
    res.json(req.cookies);
});
app.use('/api/v1', apiRouter_1.default);
httpServer.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
