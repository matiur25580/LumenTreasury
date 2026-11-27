import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { authRouter } from "./routes/auth.js";
import { organizationRouter } from "./routes/organizations.js";
import { treasuryMasterDataRouter } from "./routes/treasuryMasterData.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { env } from "./config/env.js";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/v1/health", (_request, response) => {
  response.status(200).json({ status: "ok", service: "lumentreasury-api", timestamp: new Date().toISOString() });
});
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/organizations", organizationRouter);
app.use("/api/v1/treasury", treasuryMasterDataRouter);
app.use(errorHandler);
app.use((_request, response) => {
  response.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
});
