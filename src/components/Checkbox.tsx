import { IconCheck } from "./icons";

export function Checkbox({ checked, label, onChange, large }: { checked: boolean; label: string; onChange: () => void; large?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className={`check ${large ? "large" : ""}`} onClick={onChange}>
      <span className={`check-box ${checked ? "on" : ""}`}>
        <IconCheck size={large ? 15 : 14} />
      </span>
    </button>
  );
}
