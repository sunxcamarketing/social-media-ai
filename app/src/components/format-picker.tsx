"use client";

interface FormatPickerProps {
  value: string; // " + "-joined string e.g. "Voice Over + B-Roll"
  options: string[];
  onChange: (val: string) => void;
}

export function FormatPicker({ value, options, onChange }: FormatPickerProps) {
  const selected = value ? value.split(" + ").map(s => s.trim()).filter(Boolean) : [];

  const toggle = (fmt: string) => {
    const next = selected.includes(fmt)
      ? selected.filter(s => s !== fmt)
      : [...selected, fmt];
    onChange(next.join(" + "));
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {options.map((fmt) => {
        const active = selected.includes(fmt);
        return (
          <button
            key={fmt}
            type="button"
            onClick={() => toggle(fmt)}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all ${
              active
                ? "bg-green-500/20 border-green-500/40 text-green-300"
                : "bg-white/[0.03] border-white/[0.08] text-muted-foreground hover:border-white/[0.15] hover:text-foreground"
            }`}
          >
            {fmt}
          </button>
        );
      })}
      {selected.length > 1 && (
        <span className="self-center text-[10px] text-muted-foreground/50 italic ml-1">
          {selected.join(" + ")}
        </span>
      )}
    </div>
  );
}
