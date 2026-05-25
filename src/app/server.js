import { config } from "../config.js";
import { createApp } from "./app.js";

export const app = createApp();

if (process.env.NOTARIX_DISABLE_LISTEN !== "true") {
  app.listen(config.port, () => {
    console.log(`Notarix backend listening on ${config.appUrl}`);
  });
}
