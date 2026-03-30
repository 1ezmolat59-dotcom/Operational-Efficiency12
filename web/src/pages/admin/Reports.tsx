import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { reportsApi } from '@/api/client';
import { KPIData, LaborReport, ComplianceReport, CostAnalysis } from '@/types';
import { ReportExportButtons } from '@/components/admin/ReportExportButtons';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { RefreshCw } from 'lucide-react';

type TabId = 'kpi' | 'labor' | 'compliance' | 'cost';

const TABS: { id: TabId; label: string }[] = [
  { id: 'kpi', label: 'KPI Summary' },
  { id: 'labor', label: 'Labor' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'cost', label: 'Cost Analysis' },
];

function toDateInput(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

interface KPISummaryTableProps {
  data: KPIData;
}

function KPISummaryTable({ data }: KPISummaryTableProps) {
  const rows = [
    { label: 'Cost per EVS Task', value: `$${data.costPerEVSTask.toFixed(2)}`, target: `< $${data.targets.costPerEVSTask.toFixed(2)}`, met: data.costPerEVSTask <= data.targets.costPerEVSTask },
    { label: 'Cost per Transport', value: `$${data.costPerTransport.toFixed(2)}`, target: `< $${data.targets.costPerTransport.toFixed(2)}`, met: data.costPerTransport <= data.targets.costPerTransport },
    { label: 'Avg Bed Turnaround', value: `${data.avgBedTurnaround.toFixed(0)} min`, target: `< ${data.targets.avgBedTurnaround} min`, met: data.avgBedTurnaround <= data.targets.avgBedTurnaround },
    { label: 'Overtime Rate', value: `${data.overtimeRate.toFixed(1)}%`, target: `< ${data.targets.overtimeRate}%`, met: data.overtimeRate <= data.targets.overtimeRate },
    { label: 'Checklist Compliance', value: `${data.checklistCompliance.toFixed(1)}%`, target: `> ${data.targets.checklistCompliance}%`, met: data.checklistCompliance >= data.targets.checklistCompliance },
    { label: 'Photo Compliance', value: `${data.photoCompliance.toFixed(1)}%`, target: `> ${data.targets.photoCompliance}%`, met: data.photoCompliance >= data.targets.photoCompliance },
    { label: 'On-Time Transport', value: `${data.onTimeTransport.toFixed(1)}%`, target: `> ${data.targets.onTimeTransport}%`, met: data.onTimeTransport >= data.targets.onTimeTransport },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">KPI</th>
            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Current Value</th>
            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Target</th>
            <th className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row) => (
            <tr key={row.label} className="bg-white hover:bg-gray-50">
              <td className="p-4 text-sm font-medium text-gray-900">{row.label}</td>
              <td className="p-4 text-sm text-gray-700">{row.value}</td>
              <td className="p-4 text-sm text-gray-500">{row.target}</td>
              <td className="p-4">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${row.met ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>
                  {row.met ? 'Meeting Target' : 'Below Target'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface LaborTableProps {
  data: LaborReport[];
}

function LaborTable({ data }: LaborTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="bg-gray-50">
            {['Staff Name', 'Role', 'Date', 'Hours Worked', 'Tasks Completed', 'OT Hours'].map((h) => (
              <th key={h} className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-sm text-gray-400">No labor data found for this period</td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={i} className="bg-white hover:bg-gray-50">
                <td className="p-4 text-sm font-medium text-gray-900">{row.staffName}</td>
                <td className="p-4 text-sm capitalize text-gray-600">{row.role}</td>
                <td className="p-4 text-sm text-gray-600">{row.date}</td>
                <td className="p-4 text-sm text-gray-700">{row.hoursWorked.toFixed(1)}h</td>
                <td className="p-4 text-sm text-gray-700">{row.tasksCompleted}</td>
                <td className="p-4">
                  <span className={`text-sm font-medium ${row.otHours > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                    {row.otHours.toFixed(1)}h
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface ComplianceTableProps {
  data: ComplianceReport[];
}

function ComplianceTable({ data }: ComplianceTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="bg-gray-50">
            {['Room', 'Date', 'Clean Type', 'Staff', 'Compliance %'].map((h) => (
              <th key={h} className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {data.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-8 text-center text-sm text-gray-400">No compliance data found</td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr key={i} className="bg-white hover:bg-gray-50">
                <td className="p-4 text-sm font-medium text-gray-900">Room {row.roomNumber}</td>
                <td className="p-4 text-sm text-gray-600">{row.date}</td>
                <td className="p-4 text-sm capitalize text-gray-600">{row.cleanType}</td>
                <td className="p-4 text-sm text-gray-700">{row.staffName}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    row.compliancePercent >= 90 ? 'bg-teal-100 text-teal-700' :
                    row.compliancePercent >= 70 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {row.compliancePercent.toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface CostChartProps {
  data: CostAnalysis[];
}

function CostChart({ data }: CostChartProps) {
  return (
    <div>
      <div className="mb-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e5e7eb' }}
              formatter={(v: number, name: string) => [`$${v.toFixed(2)}`, name]}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="costPerEVSTask" stroke="#0d9488" strokeWidth={2} dot={false} name="Cost/EVS Task" />
            <Line type="monotone" dataKey="costPerTransport" stroke="#7c3aed" strokeWidth={2} dot={false} name="Cost/Transport" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cost table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="bg-gray-50">
              {['Date', 'Cost/EVS Task', 'Cost/Transport', 'Total Cost'].map((h) => (
                <th key={h} className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-sm text-gray-400">No cost data found</td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={i} className="bg-white hover:bg-gray-50">
                  <td className="p-4 text-sm text-gray-700">{row.date}</td>
                  <td className="p-4 text-sm font-medium text-teal-700">${row.costPerEVSTask.toFixed(2)}</td>
                  <td className="p-4 text-sm font-medium text-purple-700">${row.costPerTransport.toFixed(2)}</td>
                  <td className="p-4 text-sm font-semibold text-gray-900">${row.totalCost.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('kpi');
  const [startDate, setStartDate] = useState(toDateInput(subDays(new Date(), 30)));
  const [endDate, setEndDate] = useState(toDateInput(new Date()));
  const [appliedStart, setAppliedStart] = useState(startDate);
  const [appliedEnd, setAppliedEnd] = useState(endDate);

  const kpiQuery = useQuery<KPIData>({
    queryKey: ['reports', 'kpi', appliedStart, appliedEnd],
    queryFn: () => reportsApi.getKPI(appliedStart, appliedEnd).then((r) => r.data),
    enabled: activeTab === 'kpi',
    retry: 1,
  });

  const laborQuery = useQuery<LaborReport[]>({
    queryKey: ['reports', 'labor', appliedStart, appliedEnd],
    queryFn: () => reportsApi.getLabor(appliedStart, appliedEnd).then((r) => r.data),
    enabled: activeTab === 'labor',
    retry: 1,
  });

  const complianceQuery = useQuery<ComplianceReport[]>({
    queryKey: ['reports', 'compliance', appliedStart, appliedEnd],
    queryFn: () => reportsApi.getCompliance(appliedStart, appliedEnd).then((r) => r.data),
    enabled: activeTab === 'compliance',
    retry: 1,
  });

  const costQuery = useQuery<CostAnalysis[]>({
    queryKey: ['reports', 'cost', appliedStart, appliedEnd],
    queryFn: () => reportsApi.getCostPerTask(appliedStart, appliedEnd).then((r) => r.data),
    enabled: activeTab === 'cost',
    retry: 1,
  });

  function handleApply() {
    setAppliedStart(startDate);
    setAppliedEnd(endDate);
  }

  const currentQuery =
    activeTab === 'kpi' ? kpiQuery :
    activeTab === 'labor' ? laborQuery :
    activeTab === 'compliance' ? complianceQuery :
    costQuery;

  function renderContent() {
    if (currentQuery.isLoading) {
      return (
        <div className="flex h-48 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    if (currentQuery.isError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">Failed to load report data.</p>
          <button
            onClick={() => currentQuery.refetch()}
            className="mt-2 flex items-center gap-1.5 mx-auto text-sm text-red-600 underline hover:no-underline"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      );
    }

    if (activeTab === 'kpi' && kpiQuery.data) {
      return <KPISummaryTable data={kpiQuery.data} />;
    }
    if (activeTab === 'labor') {
      return <LaborTable data={laborQuery.data ?? []} />;
    }
    if (activeTab === 'compliance') {
      return <ComplianceTable data={complianceQuery.data ?? []} />;
    }
    if (activeTab === 'cost') {
      return <CostChart data={costQuery.data ?? []} />;
    }
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reports & Exports</h1>
        <p className="text-sm text-gray-400">Detailed operational reports and data exports</p>
      </div>

      {/* Date range + export controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Date Range:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={endDate}
            aria-label="Report start date"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <span className="text-sm text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            max={toDateInput(new Date())}
            aria-label="Report end date"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <button
            onClick={handleApply}
            className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
          >
            Apply
          </button>
        </div>

        <ReportExportButtons
          reportType={activeTab}
          startDate={appliedStart}
          endDate={appliedEnd}
        />
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100">
          <nav className="flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-label={`View ${tab.label} report`}
                className={`flex-1 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-teal-600 text-teal-700 bg-teal-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-5">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
