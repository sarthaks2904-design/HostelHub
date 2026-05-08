const express = require("express");
const { ROLES } = require("../config");
const { requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");

function createConfigRouter(hostelService) {
  const router = express.Router();

  router.get(
    "/",
    requireRoles(ROLES.ADMIN, ROLES.WARDEN),
    asyncHandler(async (req, res) => {
      const config = await hostelService.getConfig();
      res.json(config);
    })
  );

  router.put(
    "/",
    requireRoles(ROLES.ADMIN, ROLES.WARDEN),
    asyncHandler(async (req, res) => {
      const config = await hostelService.updateConfig(req.body, req.user);
      res.json(config);
    })
  );

  return router;
}

module.exports = {
  createConfigRouter
};
