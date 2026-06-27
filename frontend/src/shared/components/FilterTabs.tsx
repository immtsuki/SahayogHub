interface FilterTabsProps {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
  className?: string;
  scroll?: boolean;
}

export default function FilterTabs({
  tabs,
  active,
  onChange,
  className = '',
  scroll = false,
}: FilterTabsProps) {
  return (
    <div
      className={`flex gap-2 ${scroll ? 'overflow-x-auto no-scrollbar' : 'flex-wrap'} ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          className={`
            shrink-0 px-4 py-1.5 rounded-full text-sm font-medium
            transition-all duration-150 cursor-pointer whitespace-nowrap
            ${
              active === tab
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-500'
            }
          `}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
