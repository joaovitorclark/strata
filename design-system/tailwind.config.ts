import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

/**
 * Strata Tailwind config.
 *
 * Deliberately mirrors Structura's `tailwind.config.ts` shape — `darkMode: ["class"]`,
 * `prefix: ""`, colours resolved as `hsl(var(--token))` — so components authored here
 * compile unchanged inside the Structura platform. Everything under "Strata domain"
 * is additive; nothing overrides a Structura-owned name.
 *
 * Tokens live in ./globals.css.
 */
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },

      colors: {
        /* ── shadcn contract (names shared with Structura) ─────────────── */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },

        /* ── extras (names shared with Structura) ──────────────────────── */
        surface: "hsl(var(--surface))",
        "surface-hover": "hsl(var(--surface-hover))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        "grid-line": "hsl(var(--grid-line))",

        /* ── Strata domain: medallion layers ───────────────────────────── */
        layer: {
          bronze: "hsl(var(--layer-bronze))",
          silver: "hsl(var(--layer-silver))",
          gold: "hsl(var(--layer-gold))",
          raw: "hsl(var(--layer-raw))",
        },

        /* ── Strata domain: edge semantics ─────────────────────────────── */
        rel: {
          fk: "hsl(var(--rel-fk))",
          lineage: "hsl(var(--rel-lineage))",
          active: "hsl(var(--rel-active))",
          muted: "hsl(var(--rel-muted))",
        },

        /* ── Strata domain: column key badges ──────────────────────────── */
        key: {
          pk: "hsl(var(--key-pk))",
          fk: "hsl(var(--key-fk))",
          unique: "hsl(var(--key-unique))",
          index: "hsl(var(--key-index))",
          pin: "hsl(var(--key-pin))",
        },

        /* ── Strata domain: DBML syntax ────────────────────────────────── */
        syn: {
          keyword: "hsl(var(--syn-keyword))",
          string: "hsl(var(--syn-string))",
          number: "hsl(var(--syn-number))",
          type: "hsl(var(--syn-type))",
          operator: "hsl(var(--syn-operator))",
          punct: "hsl(var(--syn-punct))",
          comment: "hsl(var(--syn-comment))",
          "line-active": "hsl(var(--syn-line-active))",
          gutter: "hsl(var(--syn-gutter))",
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        glow: "var(--shadow-glow)",
      },

      /* Node row heights — the Level-of-Detail system reads these. */
      spacing: {
        "row-compact": "var(--row-compact)",
        "row-cozy": "var(--row-cozy)",
      },

      fontSize: {
        /* Dense-but-comfortable scale. Data is 11–12px mono; UI is 12–14px. */
        "2xs": ["0.6875rem", { lineHeight: "1rem" }], // 11 — column types, badges
        xs: ["0.75rem", { lineHeight: "1.125rem" }], // 12 — column names, meta
        sm: ["0.8125rem", { lineHeight: "1.25rem" }], // 13 — controls, tree
        base: ["0.875rem", { lineHeight: "1.375rem" }], // 14 — body
        lg: ["1rem", { lineHeight: "1.5rem" }], // 16 — panel titles
        xl: ["1.25rem", { lineHeight: "1.75rem" }], // 20 — page titles
        "2xl": ["1.5rem", { lineHeight: "1.875rem" }], // 24 — wordmark, empty states
      },

      keyframes: {
        /* Lineage edges flow; foreign keys never move. */
        "lineage-flow": {
          to: { strokeDashoffset: "-12" },
        },
        /* A node that just received a change from the DBML drawer. */
        "node-settle": {
          "0%": { transform: "translateY(-2px)", boxShadow: "var(--shadow-glow)" },
          "100%": { transform: "translateY(0)", boxShadow: "var(--shadow-md)" },
        },
        "drawer-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
      },
      animation: {
        "lineage-flow": "lineage-flow 1.1s linear infinite",
        "node-settle": "node-settle 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "drawer-up": "drawer-up 180ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      },

      transitionTimingFunction: {
        strata: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [tailwindAnimate],
} satisfies Config;
