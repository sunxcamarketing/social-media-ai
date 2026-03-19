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
                ? "bg-green-50 border-green-200 text-green-600"
                : "bg-ocean/[0.02] border-ocean/[0.06] text-ocean/60 hover:border-ocean/[0.15] hover:text-ocean"
            }`}
          >
            {fmt}
          </button>
        );
      })}
      {selected.length > 1 && (
        <span className="self-center text-[10px] text-ocean/65 italic ml-1">
          {selected.join(" + ")}
        </span>
      )}
    </div>
  );
}
