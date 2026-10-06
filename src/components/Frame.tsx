import type { ReactNode } from "react";
import { MobileNav, MobileTop, Sidebar } from "./Nav";

/** App chrome: sidebar on desktop, top bar + bottom tabs below lg. */
export function Frame({ children, rail = false }: { children: ReactNode; rail?: boolean }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar rail={rail} />
      <div className="flex min-w-0 flex-1 flex-col pb-14 lg:pb-0">
        <MobileTop />
        {children}
      </div>
      <MobileNav />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
  badge,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="flex min-h-[68px] flex-none flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-white px-4 py-3 sm:px-7">
      <div>
        <div className="text-xs text-muted">{eyebrow}</div>
        <h1 className="text-[19px] font-semibold tracking-tight">{title}</h1>
      </div>
      {badge}
      {children && <div className="ml-auto flex items-center gap-2.5">{children}</div>}
    </header>
  );
}
