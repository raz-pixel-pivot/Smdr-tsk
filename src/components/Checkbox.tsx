import { IconCheck } from "./icons";

export function Checkbox({ checked, label, onChange, large, disabled }: { checked: boolean; label: string; onChange: () => void; large?: boolean; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className={`check ${large ? "large" : ""}`} disabled={disabled} onClick={onChange}>
      <span className={`check-box ${checked ? "on" : ""}`}>
        <IconCheck size={large ? 15 : 14} />
      </span>
    </button>
  );
}
