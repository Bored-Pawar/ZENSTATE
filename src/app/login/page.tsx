"use client";

import { useRouter } from "next/navigation";
import { Metronome } from "@phosphor-icons/react/dist/ssr";

export default function Login() {
  const router = useRouter();
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2.5">
            <Metronome size={26} weight="fill" className="text-accent" />
            <span className="text-xl font-semibold">Cadence</span>
          </div>
          <div className="eyebrow mb-2">A quieter way to move forward</div>
          <h1 className="mb-2 text-3xl font-semibold tracking-tight">Make room for what matters.</h1>
          <p className="mb-6 text-sm leading-normal text-ink-3">A planning space that respects your time, notices your effort, and helps you begin again.</p>
          <form
            className="flex flex-col gap-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              router.push("/setup");
            }}
          >
            <label className="text-xs text-muted">
              Email
              <input className="input mt-1" type="email" defaultValue="maya@example.com" required />
            </label>
            <label className="text-xs text-muted">
              Password
              <input className="input mt-1" type="password" defaultValue="demo" required />
            </label>
            <button className="btn btn-primary w-full py-3">Continue</button>
          </form>
          <p className="mt-3 text-xs text-faint">Demo mode — any email and password work.</p>
        </div>
      </main>
      <aside className="relative hidden items-end overflow-hidden bg-tint lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border border-edge" />
        <div className="absolute -right-8 top-16 h-64 w-64 rounded-full border border-edge" />
        <div className="relative p-12">
          <span className="mb-4 block h-3 w-3 rounded-full bg-accent" />
          <p className="mb-2 text-2xl font-medium text-accent-deep">One clear next step is enough.</p>
          <small className="text-[11px] uppercase tracking-[0.1em] text-muted">Cadence · daily focus</small>
        </div>
      </aside>
    </div>
  );
}
