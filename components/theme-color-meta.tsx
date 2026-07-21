"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

/** Nilai --background per tema (PRD §7.4) untuk status bar PWA Android. */
const THEME_COLOR: Record<string, string> = {
  light: "#f7f7fb",
  dark: "#0b0e1a",
};

/** Sinkronkan <meta name="theme-color"> dengan tema aktif. */
export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    let meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = THEME_COLOR[resolvedTheme] ?? THEME_COLOR.light!;
  }, [resolvedTheme]);

  return null;
}
