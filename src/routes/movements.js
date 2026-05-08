const express = require("express");
const { ROLES } = require("../config");
const { requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");

function createMovementsRouter(hostelService) {
  const router = express.Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const movements = await hostelService.getMovements(req.user);
      res.json(movements);
    })
  );

  router.post(
    "/exit",
    requireRoles(ROLES.STUDENT),
    asyncHandler(async (req, res) => {
      const result = await hostelService.requestExit(req.user.id, req.body);
      res.status(201).json(result);
    })
  );

  router.post(
    "/return",
    requireRoles(ROLES.STUDENT, ROLES.ADMIN, ROLES.WARDEN),
    asyncHandler(async (req, res) => {
      const studentId =
        req.user.role === ROLES.STUDENT ? req.user.id : String(req.body.studentId || "").trim();
      if (!studentId) {
        return res.status(400).json({ error: "studentId is required for staff return actions." });
      }

      const result = await hostelService.markReturn(studentId, req.body, req.user);
      res.json(result);
    })
  );

  router.post(
    "/scan",
    requireRoles(ROLES.ADMIN, ROLES.WARDEN),
    asyncHandler(async (req, res) => {
      const result = await hostelService.scanQr(req.user, req.body);
      res.json(result);
    })
  );

  return router;
}

module.exports = {
  createMovementsRouter
};
