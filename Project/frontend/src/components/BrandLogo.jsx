import { useState } from "react";

const CANDIDATE_LOGOS = ["/twm-logo.svg", "/twm-logo.png"];

export default function BrandLogo({ size = "small" }) {
  const [idx, setIdx] = useState(0);
  const className = size === "large" ? "brand-logo brand-logo-large" : "brand-logo";
  const fallbackClassName = size === "large" ? "brand-logo-fallback brand-logo-fallback-large" : "brand-logo-fallback";

  if (idx >= CANDIDATE_LOGOS.length) {
    return (
      <div className={fallbackClassName} title="請將 Taiwan Mobile logo 放到 frontend/public/twm-logo.svg">
        TM
      </div>
    );
  }

  return (
    <img
      key={CANDIDATE_LOGOS[idx]}
      src={CANDIDATE_LOGOS[idx]}
      alt="Taiwan Mobile"
      className={className}
      onError={() => setIdx(idx + 1)}
    />
  );
}
