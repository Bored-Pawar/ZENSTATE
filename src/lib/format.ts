const parts = (iso: string) => new Date(`${iso}T12:00:00`);

export const shortDate = (iso: string) =>
  parts(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");

export const longDate = (iso: string) =>
  parts(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export const medDate = (iso: string) =>
  parts(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
