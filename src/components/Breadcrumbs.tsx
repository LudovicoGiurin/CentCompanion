import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const { t } = useTranslation("common");
  return (
    <nav className="cc-breadcrumbs" aria-label={t("breadcrumb.aria")}>
      <ol>
        {items.map((item, i) => (
          <li key={i}>
            {item.to && i < items.length - 1 ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
