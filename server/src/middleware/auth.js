import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { AppError } from "../utils/validation.js";
export async function auth(req, _res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new Error("Missing token");
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    req.user = await User.findById(payload.sub);
    if (!req.user) throw new Error("Unknown user");
    next();
  } catch {
    next(new AppError(401, "Please log in to continue.", "UNAUTHENTICATED"));
  }
}
