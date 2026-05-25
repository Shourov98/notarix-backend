import { config } from "../config.js";
import { createApp } from "./app.js";
import { connectDatabase } from "../shared/db/connect.js";

export const app = createApp();

if (process.env.NOTARIX_DISABLE_LISTEN !== "true") {
  await connectDatabase();

  app.listen(config.port, () => {
    console.log(`Notarix backend listening on ${config.appUrl}`);
  });
}
