import { spawn } from "node:child_process";
import mongoose from "mongoose";
// Reuse the existing local MongoDB unchanged. Only this generated test DB is disposable.
const database = `zenstate_test_standalone_${Date.now()}_${process.pid}`;
const uri = `mongodb://127.0.0.1:27017/${database}`;
let server;
try {
  const client = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    const hello = await client.db("admin").command({ hello: 1 });
    console.log(
      `Test database: ${database}; MongoDB: ${hello.setName ? "replica set" : "standalone"}`,
    );
  } finally {
    await client.close();
  }
  if (process.argv.includes("--serve")) {
    const { connectDB } = await import("../src/config/db.js");
    await connectDB(uri);
    process.env.JWT_SECRET =
      "isolated-browser-test-secret-01234567890123456789";
    process.env.CLIENT_ORIGIN = "http://127.0.0.1:5173";
    delete process.env.AI_API_KEY;
    const { app } = await import("../src/app.js");
    server = app.listen(5001, "127.0.0.1", () =>
      console.log("TEST_BACKEND_READY http://127.0.0.1:5001"),
    );
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  } else {
    const tests = spawn(
      process.execPath,
      [
        "--test",
        "--experimental-test-isolation=none",
        "tests/integration/api.test.js",
      ],
      {
        windowsHide: true,
        stdio: "inherit",
        env: { ...process.env, TEST_MONGODB_URI: uri },
      },
    );
    process.exitCode = await new Promise((resolve, reject) => {
      tests.once("error", reject);
      tests.once("exit", (code) => resolve(code ?? 1));
    });
  }
} catch {
  console.error(
    "Local test run failed. Ensure your existing MongoDB accepts connections at 127.0.0.1:27017. No MongoDB service was changed.",
  );
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  const cleanup = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 3000,
  });
  try {
    await cleanup.connect();
    if (!/^zenstate_test_standalone_\d+_\d+$/.test(database))
      throw new Error("Unsafe database name");
    await cleanup.db(database).dropDatabase();
  } catch {
    console.error(
      `Test cleanup incomplete. Inspect only ${database} in Compass.`,
    );
  } finally {
    await cleanup.close();
  }
}
