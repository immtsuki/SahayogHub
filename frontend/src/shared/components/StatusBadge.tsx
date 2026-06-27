import type { ItemStatus } from '../types';

interface StatusBadgeProps {
  status: ItemStatus;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const isLost = status === 'LOST';
  return (
    <span
      className={`
        inline-flex items-center px-2 py-0.5
        rounded-full text-[10px] font-bold tracking-wider uppercase
        ${isLost ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}
        ${className}
      `}
    >
      {status}
    </span>
  );
}
