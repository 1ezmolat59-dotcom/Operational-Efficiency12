import { RoomStatus, JobType, CleanType } from '@/types';

type BadgeType = RoomStatus | JobType | CleanType | string;

interface BadgeProps {
  type: BadgeType;
  label?: string;
}

const badgeStyles: Record<string, string> = {
  // Room statuses
  dirty: 'bg-red-100 text-red-700 border border-red-200',
  in_progress: 'bg-blue-100 text-blue-700 border border-blue-200',
  clean_ready: 'bg-teal-100 text-teal-700 border border-teal-200',
  occupied: 'bg-gray-100 text-gray-600 border border-gray-200',
  offline: 'bg-gray-50 text-gray-400 border border-gray-100',

  // Clean types
  discharge: 'bg-red-100 text-red-700 border border-red-200',
  checkout: 'bg-teal-100 text-teal-700 border border-teal-200',
  routine: 'bg-gray-100 text-gray-600 border border-gray-200',

  // Job types
  stat: 'bg-red-100 text-red-700 border border-red-200',
  radiology: 'bg-purple-100 text-purple-700 border border-purple-200',

  // Job statuses
  requested: 'bg-amber-100 text-amber-700 border border-amber-200',
  accepted: 'bg-blue-100 text-blue-700 border border-blue-200',
  complete: 'bg-teal-100 text-teal-700 border border-teal-200',
  cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const badgeLabels: Record<string, string> = {
  dirty: 'Dirty',
  in_progress: 'In Progress',
  clean_ready: 'Clean & Ready',
  occupied: 'Occupied',
  offline: 'Offline',
  discharge: 'Discharge',
  checkout: 'Checkout',
  routine: 'Routine',
  stat: 'STAT',
  radiology: 'Radiology',
  requested: 'Requested',
  accepted: 'Accepted',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

export function Badge({ type, label }: BadgeProps) {
  const style = badgeStyles[type] ?? 'bg-gray-100 text-gray-600 border border-gray-200';
  const displayLabel = label ?? badgeLabels[type] ?? type;

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {displayLabel}
    </span>
  );
}
