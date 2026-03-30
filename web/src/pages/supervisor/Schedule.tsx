import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format, startOfWeek, addDays } from 'date-fns';
import { AlertTriangle, Lightbulb, CheckCheck, DollarSign, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { scheduleApi } from '@/api/client';
import { Schedule, Staff, ShiftType, ForecastDay, ShiftSuggestion } from '@/types';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

const SHIFT_LABELS: Record<ShiftType, string> = {
  day: 'Day',
  evening: 'Evening',
  off: 'Off',
  overtime: 'OT',
};

const SHIFT_STYLES: Record<ShiftType, string> = {
  day: 'bg-blue-100 text-blue-700 border border-blue-200',
  evening: 'bg-purple-100 text-purple-700 border border-purple-200',
  off: 'bg-gray-100 text-gray-500 border border-gray-200',
  overtime: 'bg-red-100 text-red-700 border border-red-200',
};

function getWeekDates(): string[] {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(monday, i), 'yyyy-MM-dd')
  );
}

function getDayLabel(dateStr: string): string {
  return format(new Date(dateStr + 'T12:00:00'), 'EEE\nMM/dd');
}

interface StaffScheduleRow {
  staff: Staff;
  shifts: Record<string, ShiftType | null>;
}

function buildScheduleMatrix(schedules: Schedule[], staff: Staff[], dates: string[]): StaffScheduleRow[] {
  return staff.map((s) => {
    const shifts: Record<string, ShiftType | null> = {};
    dates.forEach((d) => {
      const found = schedules.find((sc) => sc.staffId === s.id && sc.date === d);
      shifts[d] = found?.shiftType ?? null;
    });
    return { staff: s, shifts };
  });
}

export default function SchedulePage() {
  const queryClient = useQueryClient();
  const weekDates = getWeekDates();
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  const { data: forecast = [], isLoading: forecastLoading } = useQuery({
    queryKey: ['schedule', 'forecast'],
    queryFn: () => scheduleApi.getForecast().then((r) => r.data),
  });

  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery({
    queryKey: ['schedule', 'suggestions'],
    queryFn: () => scheduleApi.getSuggestions().then((r) => r.data),
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedule', 'week', weekDates[0]],
    queryFn: () =>
      scheduleApi
        .getSchedule(weekDates[0], weekDates[6])
        .then((r) => r.data),
  });

  const allStaff: Staff[] = schedules
    .filter((s, i, arr) => arr.findIndex((sc) => sc.staffId === s.staffId) === i)
    .map((s) => s.staff);

  const evsStaff = allStaff.filter((s) => s.role === 'housekeeper');
  const transportStaff = allStaff.filter((s) => s.role === 'transporter');

  const updateShiftMutation = useMutation({
    mutationFn: ({ staffId, date, shiftType }: { staffId: string; date: string; shiftType: ShiftType }) =>
      scheduleApi.updateShift(staffId, date, shiftType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
  });

  const applySuggestion = useCallback(
    (suggestion: ShiftSuggestion) => {
      updateShiftMutation.mutate(
        {
          staffId: suggestion.staffId,
          date: suggestion.date,
          shiftType: suggestion.suggestedShift,
        },
        {
          onSuccess: () => {
            setAppliedSuggestions((prev) => new Set([...prev, suggestion.staffId + suggestion.date]));
          },
        }
      );
    },
    [updateShiftMutation]
  );

  function applyAllSuggestions() {
    suggestions.forEach((s) => applySuggestion(s));
  }

  const gapDays = forecast.filter((d) => d.isBelowThreshold).length;
  const projectedLaborCost = forecast.reduce(
    (sum, d) => sum + d.staffedCapacity * 18,
    0
  );
  const pendingSwaps = schedules.filter((s) => s.shiftType === 'overtime').length;
  const overtimeRiskDays = forecast.filter(
    (d) => d.staffedCapacity > d.predictedDemand * 1.2
  ).length;

  const hasSuggestions = suggestions.length > 0;

  function renderStaffGroup(groupStaff: Staff[], label: string) {
    const rows = buildScheduleMatrix(schedules, groupStaff, weekDates);

    return (
      <div className="mb-6">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="w-36 p-3 text-left text-xs font-semibold text-gray-500">Staff</th>
                {weekDates.map((d) => (
                  <th key={d} className="p-3 text-center text-xs font-semibold text-gray-500">
                    <span className="whitespace-pre-line">{getDayLabel(d)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-sm text-gray-400">
                    No staff found in this group
                  </td>
                </tr>
              ) : (
                rows.map(({ staff, shifts }) => (
                  <tr key={staff.id} className="bg-white hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <p className="text-sm font-medium text-gray-900">{staff.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{staff.role}</p>
                    </td>
                    {weekDates.map((d) => {
                      const shift = shifts[d];
                      return (
                        <td key={d} className="p-2 text-center">
                          {shift ? (
                            <span
                              title={staff.name}
                              className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${SHIFT_STYLES[shift]}`}
                            >
                              {SHIFT_LABELS[shift]}
                            </span>
                          ) : (
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateShiftMutation.mutate({
                                    staffId: staff.id,
                                    date: d,
                                    shiftType: e.target.value as ShiftType,
                                  });
                                }
                              }}
                              aria-label={`Assign shift for ${staff.name} on ${d}`}
                              className="w-full rounded-md border border-dashed border-gray-300 bg-transparent px-1 py-1.5 text-xs text-gray-400 hover:border-teal-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                            >
                              <option value="">—</option>
                              <option value="day">Day</option>
                              <option value="evening">Evening</option>
                              <option value="off">Off</option>
                              <option value="overtime">OT</option>
                            </select>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Smart Scheduling</h1>
        <p className="text-sm text-gray-400">7-day demand forecast and shift management</p>
      </div>

      {/* Demand Forecast Chart */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">7-Day Demand Forecast</h2>
        {forecastLoading ? (
          <div className="flex h-48 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : forecast.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-gray-400">
            No forecast data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={forecast} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="dayOfWeek"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                formatter={(value: number) => [value, 'Tasks']}
              />
              <Bar dataKey="predictedDemand" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {forecast.map((entry: ForecastDay, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isBelowThreshold ? '#f59e0b' : '#0d9488'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Insight tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <DollarSign className="h-4 w-4 text-teal-500" />
            <span className="text-xs font-medium">Projected Labor</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${projectedLaborCost.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400">this week (est.)</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium">OT Risk Days</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{overtimeRiskDays}</p>
          <p className="text-xs text-gray-400">days overstaffed</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs font-medium">Coverage Gaps</span>
          </div>
          <p className={`text-2xl font-bold ${gapDays > 0 ? 'text-red-600' : 'text-teal-600'}`}>
            {gapDays}
          </p>
          <p className="text-xs text-gray-400">days below threshold</p>
        </div>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Clock className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-medium">OT Shifts</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingSwaps}</p>
          <p className="text-xs text-gray-400">scheduled this week</p>
        </div>
      </div>

      {/* AI Suggestion Banner */}
      {!suggestionsLoading && hasSuggestions && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Coverage gaps detected on {gapDays} day{gapDays !== 1 ? 's' : ''}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {suggestions.map((s) => {
                    const key = s.staffId + s.date;
                    const applied = appliedSuggestions.has(key);

                    return (
                      <li key={key} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-amber-700">
                          Add <strong>{SHIFT_LABELS[s.suggestedShift]}</strong> shift for{' '}
                          <strong>{s.staffName}</strong> on <strong>{s.dayOfWeek}</strong>
                          {s.reason && <span className="text-amber-600 font-normal"> — {s.reason}</span>}
                        </span>
                        <button
                          onClick={() => applySuggestion(s)}
                          disabled={applied || updateShiftMutation.isPending}
                          aria-label={`Apply suggestion for ${s.staffName} on ${s.dayOfWeek}`}
                          className={`flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                            applied
                              ? 'bg-teal-100 text-teal-700 cursor-default'
                              : 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                          }`}
                        >
                          {applied ? 'Applied' : 'Apply'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <button
              onClick={applyAllSuggestions}
              disabled={updateShiftMutation.isPending}
              aria-label="Apply all suggestions"
              className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {updateShiftMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              Apply All
            </button>
          </div>
        </div>
      )}

      {/* Weekly shift grid */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Weekly Shift Schedule</h2>

        {schedulesLoading ? (
          <div className="flex h-32 items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            {renderStaffGroup(evsStaff, 'EVS / Housekeeping')}
            {renderStaffGroup(transportStaff, 'Transport')}
          </>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.entries(SHIFT_STYLES).map(([type, style]) => (
            <span key={type} className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${style}`}>
              {SHIFT_LABELS[type as ShiftType]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
