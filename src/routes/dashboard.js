const express = require("express");
const { asyncHandler } = require("../utils/async-handler");

function createDashboardRouter(hostelService) {
  const router = express.Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const dashboard = await hostelService.getDashboardForUser(req.user);
      res.json(dashboard);
    })
  );

  return router;
}

module.exports = {
  createDashboardRouter
};
