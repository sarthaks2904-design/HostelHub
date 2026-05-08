const express = require("express");
const { ROLES } = require("../config");
const { requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");

function createStudentsRouter(hostelService) {
  const router = express.Router();

  router.get(
    "/",
    requireRoles(ROLES.ADMIN, ROLES.WARDEN),
    asyncHandler(async (req, res) => {
      const students = await hostelService.getStudentDirectory(req.user);
      res.json(students);
    })
  );

  router.get(
    "/me/qr",
    requireRoles(ROLES.STUDENT),
    asyncHandler(async (req, res) => {
      const qr = await hostelService.getStudentQrCode(req.user.id);
      res.json(qr);
    })
  );

  router.get(
    "/:id/profile",
    requireRoles(ROLES.ADMIN, ROLES.WARDEN),
    asyncHandler(async (req, res) => {
      const profile = await hostelService.getStudentProfile(req.user, req.params.id);
      res.json(profile);
    })
  );

  return router;
}

module.exports = {
  createStudentsRouter
};
