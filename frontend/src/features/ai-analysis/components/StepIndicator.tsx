interface StepIndicatorProps {
  current: number;
  total: number;
  variant?: 'bars' | 'nodes';
}

export default function StepIndicator({ current, total, variant = 'bars' }: StepIndicatorProps) {
  if (variant === 'bars') {
    return (
      <div className="flex items-center gap-1.5 w-full">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
              i + 1 <= current ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center w-full">
      {Array.from({ length: total }).map((_, i) => {
        const step      = i + 1;
        const completed = step < current;
        const active    = step === current;
        const isLast    = i === total - 1;

        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                completed
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : active
                  ? 'bg-blue-100 border-blue-500 text-blue-500'
                  : 'bg-white border-gray-300 text-gray-400'
              }`}
            >
              {completed ? (
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : active ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : (
                <span className="text-xs font-medium">{step}</span>
              )}
            </div>
            {!isLast && (
              <div className="flex-1 h-0.5 mx-1">
                <div className={`h-full rounded-full transition-all duration-500 ${step < current ? 'bg-blue-500' : 'bg-gray-200'}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
