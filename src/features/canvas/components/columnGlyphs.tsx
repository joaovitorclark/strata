import { ArrowUpRight, GitCommitHorizontal, KeyRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type ColumnGlyphFlags = {
  pk?: boolean;
  fk?: boolean;
  lineage?: boolean;
  unique?: boolean;
  index?: boolean;
  notNull?: boolean;
};

export type GlyphKind = "pk" | "fk" | "lineage" | "unique" | "index" | "notNull" | "nullable";

export function resolveGlyphKind(flags: ColumnGlyphFlags): GlyphKind {
  if (flags.pk) return "pk";
  if (flags.fk) return "fk";
  if (flags.lineage) return "lineage";
  if (flags.unique) return "unique";
  if (flags.index) return "index";
  if (flags.notNull) return "notNull";
  return "nullable";
}

const LABEL_KEY: Record<GlyphKind, string> = {
  pk: "canvas.node.glyphPk",
  fk: "canvas.node.glyphFk",
  lineage: "canvas.node.glyphLineage",
  unique: "canvas.node.glyphUnique",
  index: "canvas.node.glyphIndex",
  notNull: "canvas.node.glyphNotNull",
  nullable: "canvas.node.glyphNullable",
};

function Diamond({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0">
      <path
        d="M7 1.5 12.5 7 7 12.5 1.5 7Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function DoubleDiamond() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0">
      <path
        d="M7 1.5 12.5 7 7 12.5 1.5 7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="miter"
      />
      <path
        d="M7 3.75 10.25 7 7 10.25 3.75 7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function columnRowHint(opts: {
  type: string;
  flags: ColumnGlyphFlags;
  fkRef?: string;
}): string {
  const parts = [opts.type];
  if (opts.flags.pk) parts.push("PK");
  if (opts.flags.fk) parts.push(opts.fkRef ? `FK → ${opts.fkRef}` : "FK");
  if (opts.flags.lineage) parts.push("lineage");
  if (opts.flags.unique) parts.push("unique");
  if (opts.flags.index) parts.push("index");
  if (opts.flags.notNull) parts.push("not null");
  else parts.push("nullable");
  return parts.join(" · ");
}

export function ColumnGlyph({ flags }: { flags: ColumnGlyphFlags }) {
  const { t } = useTranslation();
  const kind = resolveGlyphKind(flags);
  const label = t(LABEL_KEY[kind]);
  const tone = kind === "pk" ? "text-key-pk" : "text-muted-foreground";
  return (
    <span
      className={cn("inline-flex size-3.5 shrink-0 items-center justify-center", tone)}
      aria-label={label}
    >
      {kind === "pk" ? <KeyRound className="size-3.5" strokeWidth={1.5} aria-hidden /> : null}
      {kind === "fk" ? <ArrowUpRight className="size-3.5" strokeWidth={1.5} aria-hidden /> : null}
      {kind === "lineage" ? (
        <GitCommitHorizontal className="size-3.5" strokeWidth={1.5} aria-hidden />
      ) : null}
      {kind === "unique" || kind === "index" ? <DoubleDiamond /> : null}
      {kind === "notNull" ? <Diamond filled /> : null}
      {kind === "nullable" ? <Diamond filled={false} /> : null}
    </span>
  );
}
