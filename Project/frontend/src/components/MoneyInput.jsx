import { useEffect, useState } from "react";

const formatter = new Intl.NumberFormat("zh-TW");

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "";
  return formatter.format(value);
}

function parseValue(text) {
  const digits = text.replace(/[^0-9]/g, "");
  return digits === "" ? "" : Number(digits);
}

export default function MoneyInput({ value, onChange, ...props }) {
  const [display, setDisplay] = useState(formatValue(value));

  useEffect(() => {
    setDisplay(formatValue(value));
  }, [value]);

  const handleChange = (e) => {
    const parsed = parseValue(e.target.value);
    onChange(parsed);
    setDisplay(formatValue(parsed));
  };

  return <input type="text" inputMode="numeric" value={display} onChange={handleChange} {...props} />;
}
