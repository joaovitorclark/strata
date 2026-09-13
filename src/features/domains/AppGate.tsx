import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import App from "@/App";
import { DomainPicker } from "@/features/domains/DomainPicker";
import * as api from "@/infrastructure/api";
import type { DomainMeta } from "@/infrastructure/api";

export function AppGate() {
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<DomainMeta | null | undefined>(undefined);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    api
      .getContext()
      .then(({ domain }) => setActiveDomain(domain))
      .catch(() => setActiveDomain(null));
  }, []);

  const handleOpened = useCallback((domain: DomainMeta) => {
    setActiveDomain(domain);
  }, []);

  const handleRepoChanged = useCallback(() => setNonce((n) => n + 1), []);

  const handleBackToDomains = useCallback(() => {
    void api.clearContext().catch(() => {});
    setActiveDomain(null);
  }, []);

  if (activeDomain === undefined) {
    return (
      <div className="flex h-svh items-center justify-center bg-background text-muted-foreground">
        {t("shell.loading")}
      </div>
    );
  }
  if (activeDomain === null) {
    return <DomainPicker onOpened={handleOpened} />;
  }
  return (
    <App
      key={`${activeDomain.id}:${nonce}`}
      domain={activeDomain}
      onBackToDomains={handleBackToDomains}
      onRepoChanged={handleRepoChanged}
    />
  );
}
