const express = require("express");
const { ROLES } = require("../config");
const { requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");

function createSosRouter(hostelService) {
  const router = express.Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const alerts = await hostelService.getSosAlerts(req.user);
      res.json(alerts);
    })
  );

  router.post(
    "/",
    requireRoles(ROLES.STUDENT),
    asyncHandler(async (req, res) => {
      const alert = await hostelService.triggerSos(req.user.id, req.body);
      res.status(201).json(alert);
    })
  );

  router.patch(
    "/:id/resolve",
    requireRoles(ROLES.ADMIN, ROLES.WARDEN),
    asyncHandler(async (req, res) => {
      const alert = await hostelService.resolveSos(req.params.id, req.user);
      res.json(alert);
    })
  );

  return router;
}

module.exports = {
  createSosRouter
};
