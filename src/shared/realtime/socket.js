import { Server } from "socket.io";
import { config } from "../../config.js";

export const initSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.socketCorsOrigin,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("join_conversation", (conversationId) => {
      if (!conversationId) {
        return;
      }

      socket.join(`conversation:${conversationId}`);
    });

    socket.on("send_message", ({ conversationId, message }) => {
      if (!conversationId || !message) {
        return;
      }

      io.to(`conversation:${conversationId}`).emit("new_message", {
        conversationId,
        message,
        createdAt: new Date().toISOString(),
      });
    });
  });

  return io;
};
