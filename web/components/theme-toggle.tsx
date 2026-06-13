"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const THEME_KEY = "construction-flow-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    const initialTheme = stored === "dark" || stored === "light" ? stored : "light";

    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";

    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
  }

  return (
    <button
      className="themeToggle"
      type="button"
      aria-label={theme === "light" ? "Включить темную тему" : "Включить светлую тему"}
      aria-pressed={theme === "dark"}
      title={theme === "light" ? "Включить темную тему" : "Включить светлую тему"}
      onClick={toggleTheme}
    >
      <span className="themeToggle__icon" aria-hidden="true">
        ☀
      </span>
      <span className="themeToggle__thumb" aria-hidden="true" />
      <span className="themeToggle__icon" aria-hidden="true">
        ◐
      </span>
    </button>
  );
}
