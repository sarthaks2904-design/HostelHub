const express = require("express");
const { ROLES } = require("../config");
const { requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");

function createNotificationsRouter(hostelService) {
  const router = express.Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const notifications = await hostelService.getNotifications(req.user);
      res.json(notifications);
    })
  );

  router.post(
    "/",
    requireRoles(ROLES.ADMIN, ROLES.WARDEN),
    asyncHandler(async (req, res) => {
      const notification = await hostelService.createNotification(req.user, req.body);
      res.status(201).json(notification);
    })
  );

  router.patch(
    "/:id/read",
    asyncHandler(async (req, res) => {
      const notification = await hostelService.markNotificationRead(req.params.id, req.user.id);
      res.json(notification);
    })
  );

  return router;
}

module.exports = {
  createNotificationsRouter
};
