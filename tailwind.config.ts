import type { Config } from "tailwindcss";

/**
 * Arta Design System — token semantik dual-theme (PRD §7.4).
 * Komponen HANYA memakai token semantik di bawah; nilai per tema
 * didefinisikan sebagai CSS variables di app/globals.css.
 *
 * SENGAJA tetap Tailwind 3.4: v4 butuh Safari 16.4+/Chrome 111+ dan "will not
 * work in older browsers" — ponsel lama wali akan rusak tampilannya. Temuan
 * npm audit di rantai Tailwind 3 bersifat dev-only. Lihat CHECKLIST-GO-LIVE §6.
 *
 * Catatan v3: warna berbasis `var(--…)` di sini TIDAK mendukung pengubah
 * opasitas (`bg-border/30` tidak dihasilkan) — pakai token apa adanya.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./modules/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        foreground: "var(--foreground)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        soft: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 4px 12px -2px rgb(15 23 42 / 0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
