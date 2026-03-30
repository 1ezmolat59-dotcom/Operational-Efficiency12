import { useState } from 'react';
import { Download, FileText, Table, RefreshCw } from 'lucide-react';
import { reportsApi } from '@/api/client';

interface ReportExportButtonsProps {
  reportType: string;
  startDate: string;
  endDate: string;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReportExportButtons({ reportType, startDate, endDate }: ReportExportButtonsProps) {
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' | 'info') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleExportPDF() {
    setExportingPDF(true);
    try {
      const res = await reportsApi.exportPDF(reportType, startDate, endDate);
      const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
      triggerDownload(blob, `${reportType}-report-${startDate}-${endDate}.pdf`);
      showToast('PDF exported successfully', 'success');
    } catch {
      showToast('Failed to export PDF. Please try again.', 'error');
    } finally {
      setExportingPDF(false);
    }
  }

  async function handleExportCSV() {
    setExportingCSV(true);
    try {
      const res = await reportsApi.exportCSV(reportType, startDate, endDate);
      const blob = new Blob([res.data as BlobPart], { type: 'text/csv' });
      triggerDownload(blob, `${reportType}-report-${startDate}-${endDate}.csv`);
      showToast('CSV exported successfully', 'success');
    } catch {
      showToast('Failed to export CSV. Please try again.', 'error');
    } finally {
      setExportingCSV(false);
    }
  }

  function handlePayrollSync() {
    showToast('Integration not yet configured', 'info');
  }

  const toastColors = {
    success: 'bg-teal-600',
    error: 'bg-red-600',
    info: 'bg-amber-500',
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${toastColors[toast.type]}`}
        >
          {toast.message}
        </div>
      )}

      <button
        onClick={handleExportPDF}
        disabled={exportingPDF}
        aria-label="Export to PDF"
        className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {exportingPDF ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        Export PDF
      </button>

      <button
        onClick={handleExportCSV}
        disabled={exportingCSV}
        aria-label="Export to CSV"
        className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {exportingCSV ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Table className="h-4 w-4" />
        )}
        Export CSV
      </button>

      <button
        onClick={handlePayrollSync}
        aria-label="Sync to payroll system"
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
      >
        <Download className="h-4 w-4" />
        Payroll Sync
      </button>
    </div>
  );
}
