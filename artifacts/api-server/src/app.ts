import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware, requireAuth } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import configRouter from "./routes/config";
import publicRouter from "./routes/public";
import legalRouter, {
  requireCurrentLegalAcceptance,
} from "./routes/legal";
import supportRouter from "./routes/support";
import paymentsWebhookRouter from "./routes/payments-webhook";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "afrilance-api" });
});

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.urlencoded({ extended: true }));

// Public routes (no Clerk auth) — registered before clerkMiddleware
app.use("/api", configRouter);
app.use(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  paymentsWebhookRouter,
);

app.use(express.json());

app.use(
  clerkMiddleware(() => ({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  })),
);

app.use("/api", legalRouter);
app.use("/api", supportRouter);
app.use("/api", requireCurrentLegalAcceptance);
app.use("/api", publicRouter);
app.use("/api", router);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status =
    typeof err === "object" && err !== null && "status" in err &&
    typeof err.status === "number" && err.status >= 400 && err.status < 500
      ? err.status
      : 500;

  req.log.error({ err, method: req.method, path: req.path, status }, "Unhandled request error");
  res.status(status).json({
    error: status === 500 ? "Internal server error" : "Invalid request",
  });
});

export default app;
