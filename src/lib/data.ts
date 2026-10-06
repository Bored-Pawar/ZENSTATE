export type CommitmentId = "sleep" | "college" | "commute" | "meals" | "gym";
export type BlockKind = "college" | "commute" | "meals" | "gym" | "study";

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** The week grid shows 06:00–22:00 at 32px an hour. */
export const GRID_START = 6;
export const GRID_END = 22;
export const HOUR_PX = 32;

export const TOTAL_HOURS = 168;
/** Hours already spoken for that aren't listed as a commitment; makes the design's 150 / 18 split add up. */
export const OTHER_HOURS = 33;

export const commitments: { id: CommitmentId; label: string; hours: number }[] = [
  { id: "sleep", label: "Sleep", hours: 56 },
  { id: "college", label: "College", hours: 31 },
  { id: "commute", label: "Commute", hours: 10 },
  { id: "meals", label: "Meals", hours: 14 },
  { id: "gym", label: "Gym", hours: 6 },
];

export type WeekBlock = {
  start: number;
  dur: number;
  kind: BlockKind;
  label: string;
  sub?: string;
};

// [start hour, duration, kind, label][] for Mon..Sun
const b = (start: number, dur: number, kind: BlockKind, label: string, sub?: string): WeekBlock => ({
  start,
  dur,
  kind,
  label,
  sub,
});

export const baselineWeek: WeekBlock[][] = [
  [b(8, 1, "commute", "Commute"), b(9, 3, "college", "Lectures"), b(12, 1, "meals", "Lunch"), b(13, 3, "college", "Lab"), b(18, 1.5, "gym", "Gym")],
  [b(8, 1, "commute", "Commute"), b(9, 2, "college", "Seminar"), b(12, 1, "meals", "Lunch"), b(14, 3, "college", "Lectures"), b(19, 1, "meals", "Dinner")],
  [b(8, 1, "commute", "Commute"), b(9, 4, "college", "Studio"), b(13, 1, "meals", "Lunch"), b(18, 1.5, "gym", "Gym"), b(20, 1, "meals", "Dinner")],
  [b(8, 1, "commute", "Commute"), b(9, 3, "college", "Lectures"), b(12, 1, "meals", "Lunch"), b(14, 2, "college", "Tutorial"), b(19, 1, "meals", "Dinner")],
  [b(8, 1, "commute", "Commute"), b(9, 3, "college", "Lectures"), b(12, 1, "meals", "Lunch"), b(18, 1.5, "gym", "Gym")],
  [b(10, 1.5, "gym", "Gym"), b(13, 1, "meals", "Lunch"), b(19, 1, "meals", "Dinner")],
  [b(13, 1, "meals", "Lunch"), b(16, 2, "college", "Reading"), b(19, 1, "meals", "Dinner")],
];

export const studyWeek: WeekBlock[][] = [
  [b(20, 2, "study", "Capstone", "§3 tests")],
  [b(17, 2, "study", "Capstone", "§3 tests")],
  [b(14, 2, "study", "Capstone", "Integrate")],
  [b(20, 2, "study", "Capstone", "§4 draft")],
  [],
  [b(15, 3, "study", "Capstone", "Write-up")],
  [b(10, 3, "study", "Capstone", "§4 draft")],
];

export const planBlocks = [
  { title: "Section 3 tests", when: "Mon 20:00 – 22:00 · 2h" },
  { title: "Section 3 tests", when: "Tue 17:00 – 19:00 · 2h" },
  { title: "Integration pass", when: "Wed 14:00 – 16:00 · 2h" },
  { title: "Section 4 draft", when: "Thu 20:00 – 22:00 · 2h" },
  { title: "Section 4 draft", when: "Sun 10:00 – 13:00 · 3h" },
  { title: "Write-up & polish", when: "Sat 15:00 – 18:00 · 3h" },
];

export const todayBlocks = [
  { time: "08:00 – 09:00", icon: "car", label: "Commute", edge: "#b8bccb" },
  { time: "09:00 – 12:00", icon: "graduation-cap", label: "Lectures", tag: "College", edge: "accent" },
  { time: "12:00 – 13:00", icon: "fork-knife", label: "Lunch", edge: "#cdd1de" },
  { time: "14:00 – 16:00", icon: "graduation-cap", label: "Tutorial", tag: "College", edge: "accent" },
  { time: "20:00 – 22:00", icon: "star", label: "Capstone · section 3 tests", tag: "Focused work", focus: true, edge: "accent" },
  { time: "22:00 – 22:30", icon: "moon-stars", label: "Wind down", edge: "#cdd1de" },
] as const;

export type Task = {
  id: string;
  title: string;
  goal: string;
  hours: number;
  scheduled: string;
  done: boolean;
  note: string;
};

export const initialTasks: Task[] = [
  { id: "t1", title: "Refactor section 3 data layer", goal: "Finish the capstone", hours: 2, scheduled: "Mon 20:00 – 22:00", done: false, note: "Split the fetch helpers from the reducers first." },
  { id: "t2", title: "Write section 3 tests", goal: "Finish the capstone", hours: 2, scheduled: "Tue 17:00 – 19:00", done: false, note: "" },
  { id: "t3", title: "Integration pass", goal: "Finish the capstone", hours: 2, scheduled: "Wed 14:00 – 16:00", done: false, note: "" },
  { id: "t4", title: "Draft section 4", goal: "Finish the capstone", hours: 5, scheduled: "Thu 20:00 · Sun 10:00", done: false, note: "Start rough. Clarity matters more than perfection." },
  { id: "t5", title: "Write-up & polish", goal: "Finish the capstone", hours: 3, scheduled: "Sat 15:00 – 18:00", done: false, note: "" },
];
