import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { reportsApi } from '@/api/client';
import { KPIData } from '@/types';
import { KPICard } from '@/components/admin/KPICard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { RefreshCw } from 'lucide-react';

function toDateInput(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

interface KPIDefinition {
  key: keyof Omit<KPIData, 'targets'>;
  targetKey: keyof KPIData['targets'];
  label: string;
  unit: string;
  higherIsBetter: boolean;
}

const KPI_DEFS: KPIDefinition[] = [
  { key: 'costPerEVSTask', targetKey: 'costPerEVSTask', label: 'Cost per EVS Task', unit: '$', higherIsBetter: false },
  { key: 'costPerTransport', targetKey: 'costPerTransport', label: 'Cost per Transport', unit: '$', higherIsBetter: false },
  { key: 'avgBedTurnaround', targetKey: 'avgBedTurnaround', label: 'Avg Bed Turnaround', unit: 'min', higherIsBetter: false },
  { key: 'overtimeRate', targetKey: 'overtimeRate', label: 'Overtime Rate', unit: '%', higherIsBetter: false },
  { key: 'checklistCompliance', targetKey: 'checklistCompliance', label: 'Checklist Compliance', unit: '%', higherIsBetter: true },
  { key: 'photoCompliance', targetKey: 'photoCompliance', label: 'Photo Compliance', unit: '%', higherIsBetter: true },
  { key: 'onTimeTransport', targetKey: 'onTimeTransport', label: 'On-Time Transport', unit: '%', higherIsBetter: true },
];

// Mock 7-day trend data for each KPI (in production, the API would return historical values)
function mockTrend(currentValue: number): number[] {
  return Array.from({ length: 7 }, (_, i) => {
    const noise = (Math.random() - 0.5) * currentValue * 0.12;
    return Math.max(0, Number((currentValue + noise * (1 - i / 7)).toFixed(2)));
  }).reverse();
}

interface DonutChartProps {
  title: string;
  value: number;
  target: number;
}

function DonutChart({ title, value, target }: DonutChartProps) {
  const remainder = 100 - value;
  const isMeeting = value >= target;

  const data = [
    { name: 'Actual', value: Math.min(value, 100) },
    { name: 'Gap', value: Math.max(0, remainder) },
  ];

  const COLORS = [isMeeting ? '#0d9488' : '#ef4444', '#f3f4f6'];

  return (
    <div className="flex flex-col items-center">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">{title}</h3>
      <div className="relative h-40 w-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={60}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(1)}%`, '']}
              contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${isMeeting ? 'text-teal-600' : 'text-red-600'}`}>
            {value.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${isMeeting ? 'bg-teal-500' : 'bg-red-400'}`} />
          <span className="text-gray-600">Actual: {value.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full bg-gray-300" />
          <span className="text-gray-500">Target: ≥{target}%</span>
        </div>
      </div>
    </div>
  );
}

export default function KPIDashboard() {
  const [startDate, setStartDate] = useState(toDateInput(subDays(new Date(), 30)));
  const [endDate, setEndDate] = useState(toDateInput(new Date()));
  const [appliedStart, setAppliedStart] = useState(startDate);
  const [appliedEnd, setAppliedEnd] = useState(endDate);

  const { data: kpi, isLoading, isError, refetch } = useQuery<KPIData>({
    queryKey: ['kpi', appliedStart, appliedEnd],
    queryFn: () => reportsApi.getKPI(appliedStart, appliedEnd).then((r) => r.data),
    retry: 1,
  });

  function handleApply() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">KPI Dashboard</h1>
          <p className="text-sm text-gray-400">Key performance indicators and compliance metrics</p>
        </div>

        {/* Date range picker */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={endDate}
            aria-label="Start date"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <span className="text-sm text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            max={toDateInput(new Date())}
            aria-label="End date"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
          >
            {isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            Apply
          </button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load KPI data.</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-red-600 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && !kpi && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* KPI Cards grid */}
      {(kpi || isLoading) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {KPI_DEFS.map((def) => (
            <KPICard
              key={def.key}
              kpi={def.label}
              value={kpi ? (kpi[def.key] as number) : 0}
              target={kpi ? (kpi.targets[def.targetKey] as number) : 0}
              unit={def.unit}
              trend={kpi ? mockTrend(kpi[def.key] as number) : undefined}
              higherIsBetter={def.higherIsBetter}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}

      {/* Compliance donut charts */}
      {kpi && (
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-sm font-semibold text-gray-900">Compliance Overview</h2>
          <div className="flex flex-wrap items-center justify-center gap-12">
            <DonutChart
              title="Checklist Compliance"
              value={kpi.checklistCompliance}
              target={kpi.targets.checklistCompliance}
            />
            <DonutChart
              title="Photo Compliance"
              value={kpi.photoCompliance}
              target={kpi.targets.photoCompliance}
            />
            <DonutChart
              title="On-Time Transport"
              value={kpi.onTimeTransport}
              target={kpi.targets.onTimeTransport}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && !kpi && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16">
          <p className="text-sm font-medium text-gray-500">No KPI data available for this period</p>
          <p className="mt-1 text-xs text-gray-400">Try adjusting the date range</p>
        </div>
      )}
    </div>
  );
}
