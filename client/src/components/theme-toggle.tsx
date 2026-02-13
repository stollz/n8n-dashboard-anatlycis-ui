import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      data-testid="button-theme-toggle"
      className="h-10 w-10 border-2 border-foreground bg-brutal-yellow shadow-brutal-sm brutal-press flex items-center justify-center hover:brightness-110 transition-all"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5 text-foreground" strokeWidth={2.5} />
      ) : (
        <Moon className="h-5 w-5 text-foreground" strokeWidth={2.5} />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
