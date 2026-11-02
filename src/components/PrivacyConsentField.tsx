import { Link } from "react-router-dom";
import { Trans } from "react-i18next";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
};

export function PrivacyConsentField({ checked, onChange, id = "privacy-consent" }: Props) {
  return (
    <label className="sc-field cc-checkbox-field" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
      />
      <span>
        <Trans
          i18nKey="privacy.consent"
          ns="common"
          components={{
            termsLink: <Link to="/terms" />,
            privacyLink: <Link to="/privacy" />,
          }}
        />
      </span>
    </label>
  );
}
