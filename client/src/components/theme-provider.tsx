import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "light" | "dark";
interface Ctx { theme: Theme; toggle: () => void; }
const ThemeContext = createContext<Ctx>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default to dark — traders work in low-light environments.
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
      return "light";
    }
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  const toggle = () => setTheme(t => t === "dark" ? "light" : "dark");
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
