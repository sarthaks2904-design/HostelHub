function notFoundHandler(req, res) {
  return res.status(404).json({
    error: "Route not found."
  });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 400;
  return res.status(statusCode).json({
    error: error.message || "Unexpected server error."
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
