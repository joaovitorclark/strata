import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type CommitFieldProps = {
  id: string;
  label: string;
  value: string;
  multiline?: boolean;
  "data-testid"?: string;
  onCommit: (next: string) => void;
};

export function CommitField({
  id,
  label,
  value,
  multiline = false,
  "data-testid": testId,
  onCommit,
}: CommitFieldProps) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const [prev, setPrev] = useState(value);
  const skipBlur = useRef(false);

  if (value !== prev) {
    setPrev(value);
    if (!focused) setDraft(value);
  }

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !multiline) {
      event.preventDefault();
      commit();
      event.currentTarget.blur();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      skipBlur.current = true;
      setDraft(value);
      event.currentTarget.blur();
    }
  };

  const shared = {
    id,
    value: draft,
    "data-testid": testId,
    "aria-label": label,
    onFocus: () => setFocused(true),
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(event.target.value),
    onBlur: () => {
      setFocused(false);
      if (skipBlur.current) {
        skipBlur.current = false;
        return;
      }
      commit();
    },
    onKeyDown,
  };

  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea
          {...shared}
          rows={3}
          className={cn(
            "min-h-[4.5rem] w-full rounded-md border border-input bg-background px-2 py-1.5",
            "font-mono text-xs text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        />
      ) : (
        <Input {...shared} className="h-8 font-mono text-xs" />
      )}
    </label>
  );
}
