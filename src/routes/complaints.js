const express = require("express");
const { ROLES } = require("../config");
const { requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");

function createComplaintsRouter(hostelService) {
  const router = express.Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const complaints = await hostelService.getComplaints(req.user, {
        section: req.query.section
      });
      res.json(complaints);
    })
  );

  router.post(
    "/",
    requireRoles(ROLES.STUDENT),
    asyncHandler(async (req, res) => {
      const complaint = await hostelService.createComplaint(req.user.id, req.body);
      res.status(201).json(complaint);
    })
  );

  router.patch(
    "/:id",
    requireRoles(ROLES.ADMIN, ROLES.WARDEN),
    asyncHandler(async (req, res) => {
      const complaint = await hostelService.updateComplaintStatus(
        req.params.id,
        req.body,
        req.user
      );
      res.json(complaint);
    })
  );

  return router;
}

module.exports = {
  createComplaintsRouter
};
