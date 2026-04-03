import { useEffect, useRef, useState } from "react";

interface ComboInputProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function ComboInput({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}: ComboInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  // sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = options
    .filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onChange(query);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [query, onChange]);

  return (
    <div ref={ref} className="relative w-full">
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        className={
          className ||
          "w-full border rounded-xl p-2.5 font-bold bg-gray-50 focus:bg-white outline-none"
        }
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <li
              key={opt}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => {
                onChange(opt);
                setQuery(opt);
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onChange(opt);
                  setQuery(opt);
                  setOpen(false);
                }
              }}
              className={`px-4 py-2.5 text-sm font-bold cursor-pointer hover:bg-blue-50 ${
                opt === value ? "bg-blue-100 text-blue-700" : "text-gray-800"
              }`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
