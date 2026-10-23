// Retained calendar history must not reserve time, contribute effort twice,
// or deliver another reminder after its replacement has been saved.
export const retiredSession = (block) =>
  block.status === "cancelled" ||
  Boolean(block.rescheduledToSessionId) ||
  Boolean(block.cancelReason);

// Older saved replacements already have supersedesSessionId. Recognise those
// links on reads without migrating records or guessing missing historical times.
export function withRescheduleHistory(blocks) {
  const replacements = new Map();
  for (const block of blocks) {
    if (block.supersedesSessionId)
      replacements.set(
        String(block.supersedesSessionId),
        block._id || block.id,
      );
  }
  return blocks.map((block) => {
    const replacement = replacements.get(String(block._id || block.id));
    return replacement && !retiredSession(block) && block.status !== "completed"
      ? {
          ...block,
          rescheduledToSessionId: replacement,
          cancelReason: "rescheduled",
        }
      : block;
  });
}
