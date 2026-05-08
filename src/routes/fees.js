const express = require("express");
const { ROLES } = require("../config");
const { requireRoles } = require("../middleware/auth");
const { asyncHandler } = require("../utils/async-handler");

function createFeesRouter(hostelService) {
  const router = express.Router();

  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const fees = await hostelService.getFeeRecords(req.user);
      res.json(fees);
    })
  );

  router.post(
    "/me/payments",
    requireRoles(ROLES.STUDENT),
    asyncHandler(async (req, res) => {
      const result = await hostelService.submitFeePayment(req.user.id, req.body);
      res.status(201).json(result);
    })
  );

  router.patch(
    "/:studentId/payments/:paymentId",
    requireRoles(ROLES.ADMIN),
    asyncHandler(async (req, res) => {
      const result = await hostelService.reviewFeePayment(
        req.params.studentId,
        req.params.paymentId,
        req.body,
        req.user
      );
      res.json(result);
    })
  );

  router.patch(
    "/:studentId",
    requireRoles(ROLES.ADMIN),
    asyncHandler(async (req, res) => {
      const result = await hostelService.updateStudentFeeRecord(
        req.params.studentId,
        req.body,
        req.user
      );
      res.json(result);
    })
  );

  router.post(
    "/:studentId/reminders",
    requireRoles(ROLES.ADMIN),
    asyncHandler(async (req, res) => {
      const result = await hostelService.sendFeeReminder(
        req.params.studentId,
        req.body,
        req.user
      );
      res.status(201).json(result);
    })
  );

  return router;
}

module.exports = {
  createFeesRouter
};
