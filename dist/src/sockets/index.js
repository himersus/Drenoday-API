"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSocketContent = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
let io;
// Inicializa o Socket.IO com o servidor HTTP
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT", "DELETE"]
        }
    });
    io.on("connection", (socket) => {
        console.log(`Cliente conectado: ${socket.id}`);
        socket.on("disconnect", () => {
            console.log(`Cliente desconectado: ${socket.id}`);
        });
    });
};
exports.initSocket = initSocket;
// Função para emitir eventos de qualquer lugar
const sendSocketContent = (event, data) => {
    if (!io) {
        console.error("Socket.IO não foi inicializado.");
        return;
    }
    ;
    io.emit(event, data);
};
exports.sendSocketContent = sendSocketContent;
