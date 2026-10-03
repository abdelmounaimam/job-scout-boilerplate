import { createContext, useContext, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Mode = "light" | "dark" | "system";
const Ctx = createContext<{ mode: Mode; setMode: (m: Mode) => void }>({ mode: "system", setMode: () => {} });

const read = (): Mode => {
  try { return (localStorage.getItem("theme") as Mode) || "system"; } catch { return "system"; }
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>(read);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "system" && mq.matches));
    apply();
    try { localStorage.setItem("theme", mode); } catch { /* private window: theme just isn't remembered */ }
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [mode]);
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export function ModeToggle() {
  const { setMode } = useContext(Ctx);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Theme">
          <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setMode("light")}><Sun /> Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("dark")}><Moon /> Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMode("system")}><Monitor /> System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
