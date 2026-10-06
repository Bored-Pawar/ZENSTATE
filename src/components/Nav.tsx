"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Metronome, SunHorizon, Path, CheckSquare, CalendarBlank, Target } from "@phosphor-icons/react/dist/ssr";

const items = [
  { href: "/today", label: "Today", Icon: SunHorizon, match: ["/today"] },
  { href: "/plan", label: "Plan", Icon: Path, match: ["/plan", "/setup"] },
  { href: "/tasks", label: "Tasks", Icon: CheckSquare, match: ["/tasks"] },
  { href: "/timetable", label: "Schedule", Icon: CalendarBlank, match: ["/timetable"] },
  { href: "/journal", label: "Journal", Icon: Target, match: ["/journal"] },
] as const;

const useActive = () => {
  const path = usePathname();
  return (match: readonly string[]) => match.some((m) => path === m || path.startsWith(`${m}/`));
};

export function Logo({ text = true }: { text?: boolean }) {
  return (
    <Link href="/today" className="flex items-center gap-2.5">
      <Metronome size={22} weight="fill" className="text-accent" />
      {text && <span className="text-[17px] font-semibold">Cadence</span>}
    </Link>
  );
}

export function Avatar({ size = 30 }: { size?: number }) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full bg-tint-3 text-xs font-semibold text-accent-chip"
      style={{ width: size, height: size }}
    >
      MO
    </div>
  );
}

export function Sidebar({ rail = false }: { rail?: boolean }) {
  const active = useActive();
  const path = usePathname();

  if (rail) {
    return (
      <aside className="sticky top-0 hidden h-screen w-[66px] flex-none flex-col items-center gap-1.5 border-r border-line bg-white py-[18px] lg:flex">
        <div className="mb-3">
          <Logo text={false} />
        </div>
        {items.map(({ href, label, Icon, match }) => {
          const on = active(match);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${on ? "bg-tint text-accent-ink" : "text-[#8288a0] hover:bg-tint/60"}`}
            >
              <Icon size={20} weight={on ? "fill" : "regular"} />
            </Link>
          );
        })}
        <div className="mt-auto">
          <Avatar />
        </div>
      </aside>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-[236px] flex-none flex-col border-r border-line bg-white px-3.5 py-[18px] lg:flex">
      <div className="px-2 pb-[18px] pt-1.5">
        <Logo />
      </div>
      <nav className="flex flex-col gap-[3px]">
        {items.map(({ href, label, Icon, match }) => {
          const on = active(match);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-[11px] rounded-lg px-2.5 py-2 text-sm ${on ? "bg-tint font-medium text-accent-ink" : "text-nav hover:bg-tint/60"}`}
            >
              <Icon size={18} weight={on ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}
      </nav>
      {path === "/today" && (
        <div className="mx-1 my-4 rounded-[10px] border border-line bg-field p-3">
          <div className="mb-1.5 text-[11px] text-muted">This week</div>
          <div className="mb-2 text-[15px] font-semibold">
            14 <span className="font-medium text-muted">of</span> 18h committed
          </div>
          <div className="h-1.5 overflow-hidden rounded-[3px] bg-[#e9eaf2]">
            <div className="h-full w-[77.8%] bg-accent" />
          </div>
        </div>
      )}
      <div className="mt-auto flex items-center gap-2.5 border-t border-line pt-3">
        <Avatar />
        <div>
          <div className="text-[13px] font-semibold">Maya Okafor</div>
          <div className="text-[11px] text-muted">Final year · Design</div>
        </div>
      </div>
    </aside>
  );
}

/** Phone / small-tablet navigation: the sidebar is hidden below lg. */
export function MobileNav() {
  const active = useActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-white lg:hidden">
      {items.map(({ href, label, Icon, match }) => {
        const on = active(match);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${on ? "text-accent-ink" : "text-muted"}`}
          >
            <Icon size={20} weight={on ? "fill" : "regular"} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileTop() {
  return (
    <div className="flex h-12 items-center border-b border-line bg-white px-4 lg:hidden">
      <Logo />
    </div>
  );
}
