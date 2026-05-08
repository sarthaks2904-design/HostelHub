const http = require("node:http");
const compression = require("compression");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { Server } = require("socket.io");
const { PUBLIC_DIR, SCHEDULER_INTERVAL_MS } = require("./config");
const { createAuthMiddleware } = require("./middleware/auth");
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");
const { createAuthRouter } = require("./routes/auth");
const { createComplaintsRouter } = require("./routes/complaints");
const { createConfigRouter } = require("./routes/config");
const { createDashboardRouter } = require("./routes/dashboard");
const { createFeesRouter } = require("./routes/fees");
const { createMessRouter } = require("./routes/mess");
const { createMovementsRouter } = require("./routes/movements");
const { createNotificationsRouter } = require("./routes/notifications");
const { createSosRouter } = require("./routes/sos");
const { createStudentsRouter } = require("./routes/students");
const { AuthService } = require("./services/auth-service");
const { DashboardService } = require("./services/dashboard-service");
const { HostelService } = require("./services/hostel-service");
const { RealtimeService } = require("./services/realtime-service");
const { SchedulerService } = require("./services/scheduler-service");
const { JsonStore } = require("./storage/json-store");
const { bootstrapData } = require("./storage/seed");

async function createServer(options = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);
  const store = new JsonStore(options.storeOptions);
  await store.initialize();
  await bootstrapData(store);

  const authService = new AuthService(store);
  const dashboardService = new DashboardService();
  const realtimeService = new RealtimeService();
  const hostelService = new HostelService(store, dashboardService, realtimeService);
  const scheduler = new SchedulerService(
    hostelService,
    options.schedulerIntervalMs || SCHEDULER_INTERVAL_MS
  );
  const authMiddleware = createAuthMiddleware(authService);

  realtimeService.attach(io, authService);

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many authentication requests. Try again later."
    }
  });

  app.use("/api/auth", authRateLimiter, createAuthRouter(authService, authMiddleware));
  app.use("/api/dashboard", authMiddleware, createDashboardRouter(hostelService));
  app.use("/api/students", authMiddleware, createStudentsRouter(hostelService));
  app.use("/api/fees", authMiddleware, createFeesRouter(hostelService));
  app.use("/api/movements", authMiddleware, createMovementsRouter(hostelService));
  app.use("/api/complaints", authMiddleware, createComplaintsRouter(hostelService));
  app.use("/api/notifications", authMiddleware, createNotificationsRouter(hostelService));
  app.use("/api/mess", authMiddleware, createMessRouter(hostelService));
  app.use("/api/sos", authMiddleware, createSosRouter(hostelService));
  app.use("/api/config", authMiddleware, createConfigRouter(hostelService));

  app.use(express.static(PUBLIC_DIR));
  app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
    res.sendFile("index.html", { root: PUBLIC_DIR });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  if (options.startScheduler !== false) {
    scheduler.start();
  }

  return {
    app,
    server,
    io,
    services: {
      store,
      authService,
      dashboardService,
      hostelService,
      realtimeService,
      scheduler
    }
  };
}

module.exports = {
  createServer
};
