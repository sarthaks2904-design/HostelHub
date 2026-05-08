const cookie = require("cookie");
const { JWT_COOKIE_NAME } = require("../config");

function createAuthMiddleware(authService) {
  return async (req, res, next) => {
    try {
      const rawHeader = req.headers.cookie || "";
      req.cookies = cookie.parse(rawHeader || "");
      const token = req.cookies[JWT_COOKIE_NAME];

      if (!token) {
        return res.status(401).json({ error: "Authentication required." });
      }

      req.user = await authService.resolveToken(token);
      return next();
    } catch (error) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }
  };
}

function requireRoles(...roles) {
  const normalizedRoles = roles.map((role) => String(role).toUpperCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    if (!normalizedRoles.includes(String(req.user.role).toUpperCase())) {
      return res.status(403).json({ error: "You do not have access to this resource." });
    }

    return next();
  };
}

module.exports = {
  createAuthMiddleware,
  requireRoles
};
