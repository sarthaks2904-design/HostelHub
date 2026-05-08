const express = require("express");
const { JWT_COOKIE_NAME } = require("../config");
const { asyncHandler } = require("../utils/async-handler");

function setAuthCookie(res, token) {
  res.cookie(JWT_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60 * 1000
  });
}

function createAuthRouter(authService, authMiddleware) {
  const router = express.Router();

  router.post(
    "/register",
    asyncHandler(async (req, res) => {
      const result = await authService.registerStudent(req.body);
      setAuthCookie(res, result.token);
      res.status(201).json(result);
    })
  );

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const result = await authService.authenticate(req.body);
      setAuthCookie(res, result.token);
      res.json(result);
    })
  );

  router.post("/logout", (req, res) => {
    res.clearCookie(JWT_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production"
    });
    res.status(204).send();
  });

  router.get(
    "/me",
    authMiddleware,
    asyncHandler(async (req, res) => {
      res.json({ user: req.user });
    })
  );

  return router;
}

module.exports = {
  createAuthRouter
};
