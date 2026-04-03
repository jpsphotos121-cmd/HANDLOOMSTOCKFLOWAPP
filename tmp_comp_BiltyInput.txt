import type React from "react";
import type { ColumnDef } from "../types";

function BiltyInput({
  prefixOptions,
  prefix,
  setPrefix,
  number,
  setNumber,
  onSearch,
  disabled,
}: {
  prefixOptions?: string[];
  prefix: string;
  setPrefix: (v: string) => void;
  number: string;
  setNumber: (v: string) => void;
  onSearch?: (p: string, n: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
        Bilty Number *
      </p>
      <div className="flex gap-2">
        <select
          value={prefix}
          disabled={disabled}
          onChange={(e) => {
            setPrefix(e.target.value);
            if (onSearch) onSearch(e.target.value, number);
          }}
          className={`w-1/3 border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold uppercase ${disabled ? "bg-gray-100 opacity-50 cursor-not-allowed" : "bg-gray-50"}`}
        >
          {(prefixOptions || ["0"]).map((p) => (
            <option key={p} value={p}>
              {p === "0" ? "-" : p.toUpperCase()}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          value={number}
          onKeyDown={(e) => {
            const allowed = [
              "Backspace",
              "Delete",
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "Tab",
              "Enter",
              "Home",
              "End",
            ];
            if (!allowed.includes(e.key) && !/^[0-9]$/.test(e.key)) {
              e.preventDefault();
            }
          }}
          onChange={(e) => {
            const numericOnly = e.target.value.replace(/[^0-9]/g, "");
            setNumber(numericOnly);
            if (onSearch) onSearch(prefix, numericOnly);
          }}
          disabled={disabled}
          className={`w-2/3 border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold ${disabled ? "bg-gray-100 opacity-50 cursor-not-allowed" : ""}`}
          placeholder="Numeric Part"
        />
      </div>
    </div>
  );
}

function DynamicFields({
  fields,
  values,
  onChange,
}: {
  fields?: ColumnDef[];
  values?: Record<string, string>;
  onChange: (k: string, v: string) => void;
}) {
  if (!fields || fields.length === 0) return null;
  return (
    <>
      {fields.map((col) => (
        <div key={col.name}>
          <p className="text-[10px] font-black uppercase text-gray-400 ml-1">
            {col.name}
          </p>
          <input
            type={col.type || "text"}
            value={values?.[col.name] || ""}
            onChange={(e) => onChange(col.name, e.target.value)}
            className="w-full border rounded-xl p-2.5 font-bold outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
        </div>
      ))}
    </>
  );
}

/* ================= DASHBOARD TAB ================= */

export { BiltyInput, DynamicFields };
