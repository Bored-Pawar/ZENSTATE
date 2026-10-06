import { Feasibility } from "@/components/Feasibility";

export default async function Fit({ searchParams }: { searchParams: Promise<{ needed?: string }> }) {
  const { needed } = await searchParams;
  const n = Number(needed);
  return <Feasibility needed={Number.isFinite(n) && n > 0 ? n : 14} available={18} />;
}
