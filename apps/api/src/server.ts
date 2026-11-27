import mongoose from "mongoose";
import { app } from "./app.js";
import { env } from "./config/env.js";

async function start() {
  await mongoose.connect(env.MONGODB_URI);
  app.listen(env.API_PORT, () => console.log(`LumenTreasury API listening on :${env.API_PORT}`));
}
start().catch((error: unknown) => { console.error("API startup failed", error); process.exit(1); });
