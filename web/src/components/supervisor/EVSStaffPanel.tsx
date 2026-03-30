import { useState } from 'react';
import { X } from 'lucide-react';
import { Staff, Room } from '@/types';
import { StatusDot } from '@/components/common/StatusDot';

interface EVSStaffPanelProps {
  staff: Staff[];
  rooms: Room[];
  onReassign: (staffId: string, roomId: string) => void;
  isLoading?: boolean;
  isSupervisor?: boolean;
}

function getStaffStatus(s: Staff): 'active' | 'overdue' | 'break' | 'offline' {
  if (!s.availabilityStatus) return 'offline';
  if (!s.currentTask) return 'break';

  // If currentTask has a timestamp embedded (ISO string), check if > 45 min
  if (s.shiftStart) {
    const taskStart = new Date(s.shiftStart);
    const minutesElapsed = (Date.now() - taskStart.getTime()) / 60000;
    if (minutesElapsed > 45) return 'overdue';
  }

  return 'active';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface ReassignModalProps {
  staff: Staff;
  rooms: Room[];
  onConfirm: (roomId: string) => void;
  onClose: () => void;
}

function ReassignModal({ staff, rooms, onConfirm, onClose }: ReassignModalProps) {
  const [selectedRoom, setSelectedRoom] = useState('');
  const availableRooms = rooms.filter((r) => r.status === 'dirty' || r.status === 'in_progress');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Reassign {staff.name}</h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-md p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4">
          <p className="mb-3 text-xs text-gray-500">Select a room to assign:</p>
          {availableRooms.length === 0 ? (
            <p className="text-sm text-gray-400">No dirty or in-progress rooms available.</p>
          ) : (
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">Select a room...</option>
              {availableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Room {r.roomNumber} — {r.status.replace('_', ' ')}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedRoom && onConfirm(selectedRoom)}
            disabled={!selectedRoom}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reassign
          </button>
        </div>
      </div>
    </div>
  );
}

export function EVSStaffPanel({ staff, rooms, onReassign, isLoading = false, isSupervisor = false }: EVSStaffPanelProps) {
  const [reassigning, setReassigning] = useState<Staff | null>(null);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <div className="h-5 w-36 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="divide-y divide-gray-50 p-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Housekeeping Staff</h3>
          <p className="text-xs text-gray-400 mt-0.5">{staff.length} staff members</p>
        </div>

        {staff.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">No housekeeping staff found</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
            {staff.map((s) => {
              const status = getStaffStatus(s);

              return (
                <li key={s.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                      {getInitials(s.name)}
                    </div>
                    <StatusDot status={status} />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {s.currentTask ? s.currentTask : s.availabilityStatus ? 'Available' : 'Off shift'}
                    </p>
                  </div>

                  {/* Reassign button */}
                  {isSupervisor && (
                    <button
                      onClick={() => setReassigning(s)}
                      aria-label={`Reassign ${s.name}`}
                      className="flex-shrink-0 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-teal-50 hover:text-teal-700 border border-gray-200 hover:border-teal-200 transition-colors"
                    >
                      Reassign
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {reassigning && (
        <ReassignModal
          staff={reassigning}
          rooms={rooms}
          onConfirm={(roomId) => {
            onReassign(reassigning.id, roomId);
            setReassigning(null);
          }}
          onClose={() => setReassigning(null)}
        />
      )}
    </>
  );
}
