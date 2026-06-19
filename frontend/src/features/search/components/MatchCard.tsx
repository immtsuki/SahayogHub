import React from "react";

export interface MatchCardProps {
  image: string;
  matchPercent: number;
  title: string;
  distance: string;
  date: string;
  desktop?: boolean;
}

const MatchCard: React.FC<MatchCardProps> = ({
  image, matchPercent, title, distance, date, desktop = false,
}) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
    <div className="relative">
      <img src={image} alt={title} className={`w-full object-cover ${desktop ? "h-44" : "h-36"}`} />
      <span className={`absolute top-2 bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow ${desktop ? "left-2" : "right-2"}`}>
        {matchPercent}%
      </span>
    </div>
    <div className="p-3 flex flex-col gap-1 flex-1">
      <p className="font-bold text-gray-900 text-sm leading-snug">{title}</p>
      <p className="text-xs text-gray-400">
        {desktop ? `${distance} • ${date}` : (
          <><span className="flex items-center gap-1"><span>📍</span>{distance}</span><span>{date}</span></>
        )}
      </p>
      <button className="mt-1.5 text-blue-500 text-xs font-semibold hover:text-blue-600 cursor-pointer text-left transition-colors">
        View Match
      </button>
    </div>
  </div>
);

export default MatchCard;
