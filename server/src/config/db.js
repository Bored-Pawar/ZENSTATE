import mongoose from "mongoose";
import {
  User,
  Task,
  ScheduleBlock,
  Note,
  Conversation,
  Message,
} from "../models/index.js";
export async function connectDB(uri) {
  if (!uri || uri.includes("<"))
    throw new Error("Configure a real MONGODB_URI in server/.env");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  for (const model of [User, Task, ScheduleBlock, Note, Conversation, Message])
    await model.init();
}
