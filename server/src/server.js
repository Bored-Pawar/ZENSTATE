import "dotenv/config";
import { connectDB } from "./config/db.js";
if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.includes("<") ||
  process.env.JWT_SECRET.length < 32
) {
  console.error(
    "Configure JWT_SECRET with at least 32 random characters in server/.env",
  );
  process.exit(1);
}
try {
  await connectDB(process.env.MONGODB_URI);
  const { app } = await import("./app.js");
  app.listen(Number(process.env.PORT) || 5000, () =>
    console.log(`Zenstate API listening on port ${process.env.PORT || 5000}`),
  );
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exitCode = 1;
}
