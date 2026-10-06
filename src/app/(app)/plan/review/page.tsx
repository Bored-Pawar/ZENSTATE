import Link from "next/link";
import { Check, DotsSixVertical, LockSimpleOpen, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/Frame";
import { WeekGrid } from "@/components/WeekGrid";
import { planBlocks } from "@/lib/data";

export default function Review() {
  return (
    <>
      <PageHeader
        eyebrow="Finish the capstone project"
        title="A plan for this week"
        badge={<span className="tag bg-tint-3 text-accent-chip sm:ml-4">This week only</span>}
      >
        <Link href="/tasks" className="btn btn-primary">
          Commit this plan <Check size={15} />
        </Link>
      </PageHeader>
      <main className="flex flex-1 flex-col gap-5 p-4 sm:p-6 lg:flex-row">
        <WeekGrid plan className="min-w-0 flex-1" />
        <aside className="flex flex-none flex-col lg:w-[320px]">
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-base font-semibold">6 focused blocks</span>
            <span className="text-[13px] text-muted">· 14 hours</span>
          </div>
          <p className="mb-3.5 text-[13px] leading-normal text-ink-3">Placed in the open evenings and weekend hours you had spare. These are suggestions — move anything that doesn&apos;t sit right.</p>
          <ul className="flex flex-col gap-2">
            {planBlocks.map((b, i) => (
              <li key={i} className="flex items-center gap-2.5 rounded-lg border border-edge bg-tint-2 px-3 py-[11px]">
                <DotsSixVertical size={16} className="text-[#b0a8dc]" />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-[#3a3550]">{b.title}</div>
                  <div className="text-[11px] text-muted">{b.when}</div>
                </div>
                <PencilSimple size={14} className="text-faint" />
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2 border-t border-line pt-3 text-xs leading-normal text-muted">
            <LockSimpleOpen size={15} className="mt-px flex-none" />
            Nothing holds until you commit. You can rearrange freely until then.
          </div>
        </aside>
      </main>
    </>
  );
}
