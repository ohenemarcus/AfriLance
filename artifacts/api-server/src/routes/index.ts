import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import profilesRouter from "./profiles";
import jobsRouter from "./jobs";
import savedJobsRouter from "./saved-jobs";
import proposalsRouter from "./proposals";
import messagesRouter from "./messages";
import notificationsRouter from "./notifications";
import reviewsRouter from "./reviews";
import dashboardRouter from "./dashboard";
import paymentsRouter from "./payments";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(profilesRouter);
router.use(jobsRouter);
router.use(savedJobsRouter);
router.use(proposalsRouter);
router.use(messagesRouter);
router.use(notificationsRouter);
router.use(reviewsRouter);
router.use(dashboardRouter);
router.use(paymentsRouter);
router.use(adminRouter);

export default router;
