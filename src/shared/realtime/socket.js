import { Server } from "socket.io";
import { verifyToken } from "../../auth.js";
import { config } from "../../config.js";

let socketServer = null;

export const initSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: config.socketCorsOrigin,
      credentials: true,
    },
  });

  socketServer = io;

  io.on("connection", (socket) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "") ||
      "";
    const auth = verifyToken(token);

    if (auth?.uid) {
      const actorType = auth.role === "admin" || auth.role === "super_admin" ? "admin" : "user";
      socket.join(`actor:${actorType}:${auth.uid}`);
      if (actorType === "admin") {
        socket.join("audience:admin");
      }
    }

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

export const emitConversationMessage = (conversationId, payload) => {
  if (!socketServer || !conversationId) {
    return;
  }

  socketServer.to(`conversation:${conversationId}`).emit("new_message", payload);
};

export const emitNotificationEvent = (notification) => {
  if (!socketServer || !notification) {
    return;
  }

  if (notification.recipientId && notification.recipientType) {
    socketServer
      .to(`actor:${notification.recipientType}:${notification.recipientId}`)
      .emit("new_notification", notification);
    return;
  }

  if (notification.audience === "admin") {
    socketServer.to("audience:admin").emit("new_notification", notification);
  }
};
