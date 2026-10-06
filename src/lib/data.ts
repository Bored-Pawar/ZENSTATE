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

export type Parsed = {
  goals: string[];
  tasks: string[];
  signals: { kind: "done" | "energy" | "late"; title: string; quote: string }[];
};

export type JournalEntry = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  text: string;
  parsed?: Parsed;
};

const wed27 = `Spent most of tonight on the capstone auth flow. Finally got the login working after about three hours — the token was refreshing twice and logging me straight back out. Obvious once I actually saw it.

Didn't get to the tests though. Ran out of steam around ten. Shattered after college again, couldn't really start until late.

Section 3 is the thing holding everything up now. If I write the tests tomorrow the rest should move faster.

Behind, but not underwater yet.`;

export const initialJournal: JournalEntry[] = [
  {
    id: "2024-08-27",
    date: "2024-08-27",
    text: wed27,
    parsed: {
      goals: ["Finish the capstone project"],
      tasks: ["Write section 3 tests", "Refactor section 3 data layer"],
      signals: [
        { kind: "done", title: "Completed: auth login", quote: "finally got the login working" },
        { kind: "energy", title: "Low energy", quote: "shattered after college again" },
        { kind: "late", title: "Late start", quote: "couldn't really start until late" },
      ],
    },
  },
  { id: "2024-08-26", date: "2024-08-26", text: "Read through the brief again, made a list of what's left." },
  { id: "2024-08-24", date: "2024-08-24", text: "Slow day. Got the repo set up and not much else." },
  { id: "2024-08-22", date: "2024-08-22", text: "Met the supervisor, scope feels bigger than I thought." },
  { id: "2024-08-21", date: "2024-08-21", text: "First proper session on section 2. Went better than expected." },
  { id: "2024-08-18", date: "2024-08-18", text: "Trying to work out a rhythm for this term." },
];

export type ImportFile = { name: string; date: string | null; on: boolean; text: string };

export const sampleImport: ImportFile[] = [
  { name: "2024-08-27-capstone.md", date: "2024-08-27", on: true, text: "" },
  { name: "notes-tuesday.md", date: "2024-08-26", on: true, text: "" },
  { name: "2024-08-24.md", date: "2024-08-24", on: true, text: "" },
  { name: "2024-08-22.md", date: "2024-08-22", on: true, text: "" },
  { name: "braindump.md", date: null, on: false, text: "" },
];

export type TimeBlock = { id: string; day: (typeof DAYS)[number]; start: number; end: number; title: string; kind: "fixed" | "focus" };

export const initialBlocks: TimeBlock[] = [
  { id: "b1", day: "Mon", start: 9, end: 12, title: "Lectures", kind: "fixed" },
  { id: "b2", day: "Mon", start: 14, end: 16, title: "Library study", kind: "focus" },
  { id: "b3", day: "Tue", start: 10, end: 13, title: "Project work", kind: "focus" },
  { id: "b4", day: "Wed", start: 9, end: 12, title: "Lectures", kind: "fixed" },
  { id: "b5", day: "Thu", start: 13, end: 16, title: "Work shift", kind: "fixed" },
  { id: "b6", day: "Fri", start: 10, end: 12, title: "Deep work", kind: "focus" },
  { id: "b7", day: "Sat", start: 11, end: 14, title: "Capstone writing", kind: "focus" },
];
