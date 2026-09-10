"use client";

import { ErrorState } from "@/components/shared/states";
import { useVendorLanguage } from "@/context/vendor-language-context";

export default function HistoryError({ reset }: { reset: () => void }) {
  const { t } = useVendorLanguage();
  return <ErrorState title={t("historyError")} description={t("historyErrorDescription")} onRetry={reset} />;
}
