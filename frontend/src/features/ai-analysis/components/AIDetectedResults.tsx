import React from "react";

const FIELDS = [
  { label: "Category", value: "Backpack" },
  { label: "Color",    value: "Black"    },
  { label: "Brand",    value: "Nike"     },
];

const CheckIcon = () => (
  <svg className="w-4 h-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

interface AIDetectedResultsProps {
  inline?: boolean;
}

const AIDetectedResults: React.FC<AIDetectedResultsProps> = ({ inline = false }) => {
  const content = (
    <>
      <h2 className="font-bold text-gray-900 text-base mb-0.5">Detected Results</h2>
      <p className="text-xs text-gray-400 mb-4">Detected Information</p>
      <div className="flex flex-col gap-3">
        {FIELDS.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{label}</span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
              {value} <CheckIcon />
            </span>
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Confidence</span>
            <span className="text-sm font-bold text-blue-500">0%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-00 rounded-full transition-all duration-700" style={{ width: "75%" }} />
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return <div className="flex flex-col justify-center">{content}</div>;
  return <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">{content}</div>;
};

export default AIDetectedResults;
