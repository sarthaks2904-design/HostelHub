const express = require("express");
const { ROLES } = require("../config");
const { requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");

function createMessRouter(hostelService) {
  const router = express.Router();

  router.get(
    "/menu",
    asyncHandler(async (req, res) => {
      const menu = await hostelService.getMessMenu();
      res.json(menu);
    })
  );

  router.put(
    "/menu",
    requireRoles(ROLES.ADMIN),
    asyncHandler(async (req, res) => {
      const result = await hostelService.updateMessMenu(req.body, req.user);
      res.json(result);
    })
  );

  router.get(
    "/feedback",
    asyncHandler(async (req, res) => {
      const feedback = await hostelService.getMealFeedback(req.user);
      res.json(feedback);
    })
  );

  router.post(
    "/feedback",
    requireRoles(ROLES.STUDENT),
    asyncHandler(async (req, res) => {
      const feedback = await hostelService.submitMealFeedback(req.user.id, req.body);
      res.status(201).json(feedback);
    })
  );

  router.get(
    "/leaves",
    asyncHandler(async (req, res) => {
      const leaves = await hostelService.getMealLeaves(req.user);
      res.json(leaves);
    })
  );

  router.post(
    "/leaves",
    requireRoles(ROLES.STUDENT),
    asyncHandler(async (req, res) => {
      const leave = await hostelService.applyMealLeave(req.user.id, req.body);
      res.status(201).json(leave);
    })
  );

  return router;
}

module.exports = {
  createMessRouter
};
