import app from "./app";
import { logger } from "./lib/logger";
import { ensureMessagingSchema } from "./lib/ensureMessagingSchema";
import { ensureNotificationEmailSchema } from "./lib/ensureNotificationEmailSchema";
import { startNotificationEmailWorker } from "./lib/notificationEmail";

const rawPort = process.env["PORT"] ?? "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  await ensureMessagingSchema();
  await ensureNotificationEmailSchema();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startNotificationEmailWorker();
  });
}

startServer().catch((err) => {
  logger.error({ err }, "Failed to prepare server database schema");
  process.exit(1);
});
