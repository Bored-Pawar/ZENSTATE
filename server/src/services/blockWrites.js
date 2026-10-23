import { ScheduleBlock } from "../models/index.js";
import { fail } from "../utils/validation.js";

// Used only when editing/splitting timetable records. Validate every replacement,
// save all of them, then remove originals. No MongoDB transaction is required.
export async function replaceBlocks(userId, originals, proposed) {
  const replacements = proposed.map((fields) => new ScheduleBlock(fields));
  for (const block of replacements) await block.validate();
  try {
    for (const block of replacements) await block.save();
    for (const block of originals)
      await ScheduleBlock.deleteOne({ _id: block._id, userId });
    return replacements;
  } catch (error) {
    try {
      // Restore only missing originals; do not overwrite an existing document.
      for (const block of originals)
        await ScheduleBlock.updateOne(
          { _id: block._id, userId },
          { $setOnInsert: block },
          { upsert: true, timestamps: false },
        );
      await ScheduleBlock.deleteMany({
        userId,
        _id: { $in: replacements.map((b) => b._id) },
      });
    } catch {
      fail(
        "Timetable cleanup could not finish. Reload and inspect these blocks before retrying.",
        503,
        "PARTIAL_WRITE",
      );
    }
    throw error;
  }
}
