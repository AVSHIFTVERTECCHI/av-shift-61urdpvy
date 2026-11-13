import { NavLink } from "react-router-dom";
import { CalendarDays, Download, Plus, SlidersHorizontal, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/install";

function useTimecode() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 40);
    return () => clearInterval(t);
  }, []);
  const p = (n: number) => String(n).padStart(2, "0");
  const frames = Math.floor(now.getMilliseconds() / 40);
  return `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}:${p(frames)}`;
}

const NAV = [
  { to: "/", label: "Compensi", Icon: Wallet, testid: "nav-compensi" },
  { to: "/calendario", label: "Calendario", Icon: CalendarDays, testid: "nav-calendario" },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5" data-testid="app-logo">
      <span className="size-2.5 rounded-full bg-red-500 animate-rec" aria-hidden="true" />
      <span className="font-heading text-xl font-extrabold tracking-tight">
        AV<span className="text-primary">SHIFT</span>
      </span>
    </div>
  );
}

/**
 * App chrome. Desktop (lg+): fixed left sidebar — pages add `lg:pl-64`.
 * Phone/tablet: slim top bar + bottom tab bar (iPhone-app style, safe-area aware) — pages add bottom padding.
 */
export default function Header({ onAdd, onSettings }: { onAdd?: () => void; onSettings: () => void }) {
  const tc = useTimecode();
  const install = useInstallPrompt();

  return (
    <>
      {/* ---------- Desktop sidebar ---------- */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-[#232A3B] bg-[#0B0D13]/90 px-4 py-6 backdrop-blur-xl lg:flex"
        data-testid="desktop-sidebar"
      >
        <div className="px-2">
          <Logo />
          <span className="mt-3 inline-block rounded border border-[#232A3B] bg-black/40 px-2 py-1 font-mono text-xs tabular-nums tracking-wider text-primary" data-testid="header-timecode">
            {tc}
          </span>
        </div>
        {onAdd && (
          <Button size="lg" onClick={onAdd} data-testid="add-shift-button" className="mt-6 h-11 w-full font-semibold">
            <Plus aria-hidden="true" /> Nuova giornata
          </Button>
        )}
        <nav className="mt-6 space-y-1" aria-label="Navigazione principale">
          {NAV.map(({ to, label, Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              end
              data-testid={`${testid}-desktop`}
              className={({ isActive }) =>
                `flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-200 ${
                  isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-[#1C2233] hover:text-foreground"
                }`
              }
            >
              <Icon className="size-4.5" aria-hidden="true" /> {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={onSettings}
            data-testid="open-settings-button-desktop"
            className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-[#1C2233] hover:text-foreground"
          >
            <SlidersHorizontal className="size-4.5" aria-hidden="true" /> Service & tariffe
          </button>
        </nav>
        <div className="mt-auto space-y-3 px-1">
          {install.canInstall && (
            <Button variant="outline" className="w-full" onClick={install.prompt} data-testid="install-app-button">
              <Download aria-hidden="true" /> Installa app sul PC
            </Button>
          )}
          <p className="px-2 text-[11px] leading-relaxed text-muted-foreground">
            Giornate, orari e compensi per tecnici video.
          </p>
        </div>
      </aside>

      {/* ---------- Phone/tablet top bar ---------- */}
      <header className="sticky top-0 z-40 border-b border-[#232A3B] bg-[#0B0D13]/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-6">
          <Logo />
          <span className="hidden rounded border border-[#232A3B] bg-black/40 px-2 py-1 font-mono text-xs tabular-nums tracking-wider text-primary sm:inline">
            {tc}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {onAdd && (
              <Button size="sm" onClick={onAdd} data-testid="add-shift-button-mobile" className="hidden h-9 font-semibold sm:inline-flex">
                <Plus aria-hidden="true" /> Nuova giornata
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Phone/tablet bottom tab bar ---------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#232A3B] bg-[#0B0D13]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
        aria-label="Navigazione"
        data-testid="mobile-tabbar"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-3">
          {NAV.map(({ to, label, Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              end
              data-testid={testid}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-200 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`
              }
            >
              <Icon className="size-5" aria-hidden="true" /> {label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={onSettings}
            data-testid="open-settings-button"
            aria-label="Service e tariffe"
            className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors duration-200 active:text-foreground"
          >
            <SlidersHorizontal className="size-5" aria-hidden="true" /> Service
          </button>
        </div>
      </nav>
    </>
  );
}
