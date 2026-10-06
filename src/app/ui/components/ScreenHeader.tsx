import { useUILanguage } from "../UILanguageContext.js";

export function ScreenHeader({
  title,
  onBack,
  backLabel,
  className,
}: {
  title: string;
  onBack: () => void;
  backLabel?: string;
  className?: string;
}) {
  const { t } = useUILanguage();

  return (
    <header className={`page-header${className ? ` ${className}` : ""}`}>
      <button className="link-button" onClick={onBack}>
        {backLabel ?? t("back")}
      </button>
      <h1>{title}</h1>
    </header>
  );
}
