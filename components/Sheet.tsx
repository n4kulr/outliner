import { ReactNode, useEffect } from "react";

type Props = {
  title: string;
  onClose: () => void;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  children: ReactNode;
};

// A glass modal: slides up from the bottom on phones, floats in the middle on bigger screens.
export default function Sheet({ title, onClose, leftAction, rightAction, children }: Props) {
  // Close with the Escape key
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/25 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className="glass glass-strong sheet-in max-h-[88vh] w-full overflow-y-auto rounded-t-[32px] pb-6 sm:max-w-md sm:rounded-[32px]"
      >
        {/* Grabber + navigation bar */}
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-fill-2 sm:hidden" />
        <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pb-2 pt-3">
          <div className="justify-self-start">{leftAction}</div>
          <h2 className="text-[17px] font-semibold text-label">{title}</h2>
          <div className="justify-self-end">{rightAction}</div>
        </div>
        <div className="px-4">{children}</div>
      </div>
    </div>
  );
}

// An iOS "inset grouped" list section.
export function Group({ children }: { children: ReactNode }) {
  return <div className="mt-4 divide-y divide-separator overflow-hidden rounded-2xl bg-grouped">{children}</div>;
}

// One row in a group: a label on the left, a control on the right.
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-h-[46px] items-center justify-between gap-3 px-4 py-2 text-[16px] text-label">
      <span>{label}</span>
      {children}
    </label>
  );
}

// An iOS switch.
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  let trackClass = "bg-fill-2";
  let knobClass = "translate-x-0.5";
  if (checked) {
    trackClass = "bg-[#34c759]";
    knobClass = "translate-x-[22px]";
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${trackClass}`}
    >
      <span className={`absolute top-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform ${knobClass}`} />
    </button>
  );
}
