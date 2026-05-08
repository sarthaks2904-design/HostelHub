const jwt = require("jsonwebtoken");
const { JWT_SECRET, JWT_TTL } = require("../config");

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_TTL
  });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  signToken,
  verifyToken
};
