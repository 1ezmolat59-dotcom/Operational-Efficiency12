import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { X, UserPlus, FileText, Clock, CheckCircle } from 'lucide-react';
import { Room, RoomStatus } from '@/types';
import { Badge } from '@/components/common/Badge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface RoomGridProps {
  rooms: Room[];
  onRoomClick?: (room: Room) => void;
  isSupervisor?: boolean;
  isLoading?: boolean;
}

const roomCardStyles: Record<RoomStatus, string> = {
  dirty: 'bg-red-50 border-red-200 hover:bg-red-100',
  in_progress: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
  clean_ready: 'bg-teal-50 border-teal-200 hover:bg-teal-100',
  occupied: 'bg-gray-100 border-gray-200 hover:bg-gray-200',
  offline: 'bg-gray-50 border-gray-100 opacity-60',
};

const roomNumberColors: Record<RoomStatus, string> = {
  dirty: 'text-red-700',
  in_progress: 'text-blue-700',
  clean_ready: 'text-teal-700',
  occupied: 'text-gray-700',
  offline: 'text-gray-400',
};

interface DetailPanelProps {
  room: Room;
  isSupervisor: boolean;
  onClose: () => void;
}

function DetailPanel({ room, isSupervisor, onClose }: DetailPanelProps) {
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [patientName, setPatientName] = useState('');
  const [patientId, setPatientId] = useState('');

  const lastClean = room.lastClean;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative flex w-full max-w-sm flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Room {room.roomNumber}</h2>
            <p className="text-xs text-gray-400 capitalize">{room.roomType} room — {room.wingId}</p>
          </div>
          <button onClick={onClose} aria-label="Close panel" className="rounded-lg p-1.5 hover:bg-gray-100">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Status</p>
            <Badge type={room.status} />
          </div>

          {/* Patient info */}
          {room.patientName && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Current Patient</p>
              <p className="text-sm font-medium text-gray-900">{room.patientName}</p>
              {room.currentPatientId && (
                <p className="text-xs text-gray-400">ID: {room.currentPatientId}</p>
              )}
            </div>
          )}

          {/* Mobility equipment */}
          {room.mobilityEquipmentRequired && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
              <span className="text-xs font-medium text-amber-700">Mobility equipment required</span>
            </div>
          )}

          {/* Last clean */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">Last Clean</p>
            {lastClean ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Type</span>
                  <Badge type={lastClean.cleanType} />
                </div>
                {lastClean.staff && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Cleaned by</span>
                    <span className="font-medium text-gray-900">{lastClean.staff.name}</span>
                  </div>
                )}
                {lastClean.completedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Completed</span>
                    <span className="text-gray-900">
                      {formatDistanceToNow(new Date(lastClean.completedAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
                {lastClean.duration && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Duration</span>
                    <span className="flex items-center gap-1 text-gray-900">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      {lastClean.duration} min
                    </span>
                  </div>
                )}
                {lastClean.complianceScore !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Compliance</span>
                    <span className={`font-semibold ${lastClean.complianceScore >= 90 ? 'text-teal-600' : lastClean.complianceScore >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                      {lastClean.complianceScore}%
                    </span>
                  </div>
                )}
                {lastClean.photos && lastClean.photos.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Photos</span>
                    <span className="flex items-center gap-1 text-teal-600">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {lastClean.photos.length} uploaded
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No clean record available</p>
            )}
          </div>

          {/* Last updated */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">Last Updated</p>
            <p className="text-sm text-gray-600">
              {format(new Date(room.updatedAt), 'MMM d, yyyy h:mm a')}
            </p>
          </div>

          {/* Assign Patient form */}
          {showAssignForm && (
            <div className="rounded-lg border border-gray-200 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-800">Assign Patient</h4>
              <input
                type="text"
                placeholder="Patient ID"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <input
                type="text"
                placeholder="Patient Name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAssignForm(false)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  disabled={!patientName || !patientId}
                  className="flex-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-gray-100 p-5 space-y-2">
          {isSupervisor && room.status === 'clean_ready' && !showAssignForm && (
            <button
              onClick={() => setShowAssignForm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Assign Patient
            </button>
          )}
          <a
            href={`/rooms/${room.id}/audit`}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-4 w-4" />
            View Full Audit
          </a>
        </div>
      </div>
    </div>
  );
}

export function RoomGrid({ rooms, onRoomClick, isSupervisor = false, isLoading = false }: RoomGridProps) {
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const handleClick = (room: Room) => {
    setSelectedRoom(room);
    onRoomClick?.(room);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg bg-gray-100 border border-gray-200"
          />
        ))}
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
        <p className="text-sm font-medium text-gray-500">No rooms found</p>
        <p className="mt-1 text-xs text-gray-400">Rooms will appear here once loaded</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-6">
        {rooms.map((room) => {
          const cardStyle = roomCardStyles[room.status];
          const numberColor = roomNumberColors[room.status];

          return (
            <button
              key={room.id}
              onClick={() => handleClick(room)}
              aria-label={`Room ${room.roomNumber}, status: ${room.status}`}
              className={`relative flex flex-col items-start rounded-lg border p-3 text-left transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 ${cardStyle}`}
            >
              {/* Room number */}
              <span className={`text-base font-bold ${numberColor}`}>
                {room.roomNumber}
              </span>

              {/* Status badge */}
              <Badge type={room.status} />

              {/* Patient name */}
              {room.patientName && (
                <p className="mt-1 w-full truncate text-xs text-gray-500">
                  {room.patientName}
                </p>
              )}

              {/* Last clean time */}
              {room.lastClean?.completedAt && (
                <p className="mt-1 text-xs text-gray-400">
                  {formatDistanceToNow(new Date(room.lastClean.completedAt), { addSuffix: true })}
                </p>
              )}

              {/* In-progress spinner */}
              {room.status === 'in_progress' && (
                <span className="absolute right-2 top-2">
                  <LoadingSpinner size="sm" color="text-blue-500" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail side panel */}
      {selectedRoom && (
        <DetailPanel
          room={selectedRoom}
          isSupervisor={isSupervisor}
          onClose={() => setSelectedRoom(null)}
        />
      )}
    </>
  );
}
