export function errorHandler(error, _req, res, _next) {
  if (error.code === 11000)
    return res.status(409).json({
      error: {
        code: "DUPLICATE",
        message:
          "This email or submission already exists. Please sign in or retry with the saved record.",
      },
    });
  if (error.name === "CastError")
    return res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Record not found" } });
  if (error.name === "ValidationError")
    return res
      .status(400)
      .json({ error: { code: "INVALID_REQUEST", message: error.message } });
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: {
      code: error.code || "SERVER_ERROR",
      message:
        status === 500
          ? "Could not save this change. Please try again."
          : error.message,
      details: error.details,
    },
  });
}
