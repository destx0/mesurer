import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

export const inputClassName =
  "h-10 w-full min-w-0 rounded-md border border-border bg-bg px-3 font-mono text-[14px] text-strong outline-none transition-colors placeholder:text-muted hover:border-neutral-300 focus:border-strong";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={`${label} ${value}`}
      className="h-7 shrink-0 rounded-md border border-border px-2.5 text-[13px] text-strong transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => setCopied(true));
      }}
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

/** A result with its name, to read and to copy. */
export function Output({ label, value, large = false }: { label: string; value: string; large?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] text-muted">{label}</span>
        <output className={`truncate font-mono text-strong ${large ? "text-xl" : "text-[14px]"}`}>{value}</output>
      </div>
      <CopyButton value={value} />
    </div>
  );
}

export function Field({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      <input {...props} className={`${inputClassName} ${className}`} />
    </label>
  );
}

/** The frame a tool sits in. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border p-4 sm:p-6 ${className}`}>{children}</div>;
}

/**
 * Keeps what a tool is set to in the address, so that a link to it opens the same thing. It is
 * read once the page is shown, not before: the page is first drawn as it was built.
 */
export function useQueryState(values: Record<string, string>, onRead: (params: URLSearchParams) => void) {
  const query = new URLSearchParams(values).toString();
  const written = useRef(query);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ([...params.keys()].length > 0) onRead(params);
    // Read once, when the page is first shown.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (written.current === query) return;
    written.current = query;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query}`);
  }, [query]);
}
