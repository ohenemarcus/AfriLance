import express, { type Express } from "express";
import fs from "fs";
import os from "os";
import path from "path";
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
import paymentsWebhookRouter from "./routes/payments-webhook";
import { logger } from "./lib/logger";

const app: Express = express();

// Debug: append basic request info to a file for troubleshooting 400 responses
try {
  const debugLogPath = path.join(os.tmpdir(), "afrilance-request-debug.log");
  app.use((req, _res, next) => {
    try {
      const entry = {
        ts: new Date().toISOString(),
        method: req.method,
        path: req.path,
        headers: {
          // redact full authorization value but keep presence/length for debugging
          authorization: req.headers.authorization ? `${String(req.headers.authorization).slice(0, 64)}...` : null,
          host: req.headers.host,
          origin: req.headers.origin,
        },
      };
      fs.appendFileSync(debugLogPath, JSON.stringify(entry) + "\n");
    } catch (e) {
      /* ignore logging errors */
    }
    next();
  });
} catch (e) {
  // ignore
}

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

app.use((req, _res, next) => {
  const authHeader = req.headers.authorization;
  req.log.info(
    {
      path: req.path,
      authHeader: authHeader ? `${authHeader.slice(0, 20)}...` : null,
    },
    "auth header debug",
  );

  if (req.headers.authorization?.startsWith("Bearer ")) {
    req.headers.authorization = req.headers.authorization;
  }
  next();
});

app.use("/api", publicRouter);
app.use("/api", router);

export default app;
