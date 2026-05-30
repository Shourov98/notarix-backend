import http from "node:http";
import { config } from "../config.js";
import { createApp } from "./app.js";
import { connectDatabase } from "../shared/db/connect.js";
import { initSocketServer } from "../shared/realtime/socket.js";

export const app = createApp();
export const httpServer = http.createServer(app);
export const io = initSocketServer(httpServer);

app.locals.io = io;

if (process.env.NOTARIX_DISABLE_LISTEN !== "true") {
  await connectDatabase();

  httpServer.listen(config.port, () => {
    console.log(`Notarix backend listening on ${config.appUrl}`);
  });
}
