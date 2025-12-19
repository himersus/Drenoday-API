import { Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";

let io: IOServer;

// Inicializa o Socket.IO com o servidor HTTP
export const initSocket = (server: HttpServer) => {
  io = new IOServer(server, {
    cors: {
      origin: "*", // ou coloque seu front-end
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

// Função para emitir eventos de qualquer lugar
export const sendSocketContent = (event: string, data: any) => {
  if (!io) {
    console.error("Socket.IO não foi inicializado.");
    return;
  };
  io.emit(event, data);
};
