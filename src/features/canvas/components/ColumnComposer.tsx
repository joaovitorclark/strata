import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { filterDialectTypes } from "@/features/dbt-source/dialectTypes";
import { columnNameError } from "@/features/dbt-source/columnName";
import { cn } from "@/lib/utils";

type Props = {
  existing: string[];
  onCommit: (name: string, dataType: string) => void;
  onCancel: () => void;
};

export function ColumnComposer({ existing, onCommit, onCancel }: Props) {
  const { t } = useTranslation();
  const nameRef = useRef<HTMLInputElement>(null);
  const typeRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState("string");
  const [focus, setFocus] = useState<"name" | "type">("name");
  const [hi, setHi] = useState(0);
  useEffect(() => {
    if (focus === "name") nameRef.current?.focus();
    else typeRef.current?.focus();
  }, [focus]);
  const suggestions = useMemo(() => filterDialectTypes(dataType), [dataType]);
  const err = columnNameError(name, existing);
  const errText =
    err === "empty"
      ? t("canvas.node.columnNameEmpty")
      : err === "invalid"
        ? t("canvas.node.columnNameInvalid")
        : err === "duplicate"
          ? t("canvas.node.columnNameDuplicate")
          : null;

  const submit = () => {
    if (err) return;
    onCommit(name.trim(), dataType.trim() || "string");
  };

  const onNameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      setFocus("type");
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!err) setFocus("type");
      return;
    }
    if (e.key === "Escape") onCancel();
  };

  const onTypeKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Tab" && suggestions[hi]) {
      e.preventDefault();
      setDataType(suggestions[hi]);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === "Escape") onCancel();
  };

  return (
    <div
      className="col-add nodrag nopan flex w-full flex-col gap-0.5 px-2 py-1"
      data-testid="col-composer"
    >
      <div className="flex gap-1">
        <input
          data-testid="col-add-name"
          ref={nameRef}
          className="h-6 min-w-0 flex-1 rounded-sm border border-input bg-background px-1 font-mono text-2xs"
          placeholder={t("canvas.node.columnNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onNameKey}
          onFocus={() => setFocus("name")}
        />
        <input
          data-testid="col-add-type"
          ref={typeRef}
          className="h-6 min-w-0 flex-1 rounded-sm border border-input bg-background px-1 font-mono text-2xs"
          placeholder={t("canvas.node.columnTypePlaceholder")}
          value={dataType}
          onChange={(e) => {
            setDataType(e.target.value);
            setHi(0);
          }}
          onKeyDown={onTypeKey}
          onFocus={() => setFocus("type")}
        />
      </div>
      {errText && focus === "name" ? (
        <p data-testid="col-rename-error" className="text-[10px] text-destructive">
          {errText}
        </p>
      ) : null}
      {focus === "type" && suggestions.length ? (
        <ul
          data-testid="type-suggest"
          className="max-h-24 overflow-auto rounded-sm border border-border bg-popover p-0.5"
        >
          {suggestions.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                className={cn("w-full px-1 text-left font-mono text-2xs", i === hi && "bg-accent")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDataType(s);
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
