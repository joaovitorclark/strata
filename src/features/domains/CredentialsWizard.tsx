import { useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import * as api from "@/infrastructure/api";
import { buildTokenCreationUrl } from "@/features/domains/tokenUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CredentialsWizard({
  domainId,
  host,
  onDone,
  onCancel,
}: {
  domainId: string;
  host: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const tokenRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tokenUrl = buildTokenCreationUrl(host);

  const handleSubmit = async () => {
    const token = tokenRef.current?.value.trim() ?? "";
    if (!username.trim() || !token) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.submitGitCredential(domainId, host, username.trim(), token);
      onDone();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      data-credentials-wizard="overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="credentials-wizard-title"
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg"
      >
        <h3 id="credentials-wizard-title" className="text-lg font-semibold">
          {t("domains.credentials.title", { host })}
        </h3>
        <p className="text-sm text-muted-foreground">
          <Trans
            i18nKey="domains.credentials.intro"
            values={{ host }}
            components={{ bold: <strong className="text-foreground" /> }}
          />
        </p>
        {tokenUrl ? (
          <a
            href={tokenUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("domains.credentials.openTokenPage", { host })}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("domains.credentials.unknownHost", { host })}
          </p>
        )}
        <Input
          placeholder={t("domains.credentials.username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <Input
          ref={tokenRef}
          placeholder={t("domains.credentials.token")}
          type="password"
          autoComplete="off"
        />
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
            {t("common.save")}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
