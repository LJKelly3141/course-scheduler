interface TermTypeToggleProps {
  termType: "summer" | "winter";
  available: boolean;
  onChange: (available: boolean) => void;
}

const LABELS = { summer: "Summer", winter: "Winter" };

export function TermTypeToggle({ termType, available, onChange }: TermTypeToggleProps) {
  return (
    <div className="flex flex-col items-center max-w-sm mx-auto py-8">
      <h3 className="text-lg font-semibold text-primary mb-2">
        {LABELS[termType]} Availability
      </h3>
      <p className="text-sm text-secondary mb-6">
        Is this instructor available to teach during {LABELS[termType]} terms?
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => onChange(true)}
          className={`flex-1 min-w-[140px] rounded-xl p-5 text-center transition-all border-2 ${
            available
              ? "bg-emerald-900/50 border-emerald-500 text-emerald-400"
              : "bg-surface border-border text-secondary hover:border-border-hover"
          }`}
        >
          <div className="text-3xl mb-1">✓</div>
          <div className="font-semibold">Available</div>
        </button>
        <button
          onClick={() => onChange(false)}
          className={`flex-1 min-w-[140px] rounded-xl p-5 text-center transition-all border-2 ${
            !available
              ? "bg-red-900/50 border-red-500 text-red-400"
              : "bg-surface border-border text-secondary hover:border-border-hover"
          }`}
        >
          <div className="text-3xl mb-1">✗</div>
          <div className="font-semibold">Not Available</div>
        </button>
      </div>
      <p className="text-xs text-tertiary mt-4">
        This applies as the default for all future {LABELS[termType]} terms. Can be overridden per-term.
      </p>
    </div>
  );
}
