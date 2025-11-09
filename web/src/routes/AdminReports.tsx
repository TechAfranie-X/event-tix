import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminGetJson } from '../lib/adminApi';
import Toast from '../components/Toast';

interface TicketTypeStats {
  sold: number;
  capacity: number;
  remaining: number;
  revenue_cents: number;
}

interface EventReport {
  event_id: number;
  event_name: string;
  vip: TicketTypeStats;
  regular: TicketTypeStats;
  totals: TicketTypeStats;
}

export default function AdminReports() {
  const [reports, setReports] = useState<EventReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await adminGetJson<EventReport[]>('/api/admin/reports');
      setReports(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const exportToCSV = () => {
    if (reports.length === 0) return;

    // Create CSV header
    const headers = [
      'Event ID',
      'Event Name',
      'VIP Sold',
      'VIP Capacity',
      'VIP Remaining',
      'VIP Revenue',
      'Regular Sold',
      'Regular Capacity',
      'Regular Remaining',
      'Regular Revenue',
      'Total Sold',
      'Total Capacity',
      'Total Remaining',
      'Total Revenue',
    ];

    // Create CSV rows
    const rows = reports.map((report) => [
      report.event_id.toString(),
      report.event_name,
      report.vip.sold.toString(),
      report.vip.capacity.toString(),
      report.vip.remaining.toString(),
      formatCurrency(report.vip.revenue_cents),
      report.regular.sold.toString(),
      report.regular.capacity.toString(),
      report.regular.remaining.toString(),
      formatCurrency(report.regular.revenue_cents),
      report.totals.sold.toString(),
      report.totals.capacity.toString(),
      report.totals.remaining.toString(),
      formatCurrency(report.totals.revenue_cents),
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sales-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate grand totals
  const grandTotals = reports.reduce(
    (acc, report) => ({
      vip_sold: acc.vip_sold + report.vip.sold,
      vip_capacity: acc.vip_capacity + report.vip.capacity,
      vip_revenue: acc.vip_revenue + report.vip.revenue_cents,
      regular_sold: acc.regular_sold + report.regular.sold,
      regular_capacity: acc.regular_capacity + report.regular.capacity,
      regular_revenue: acc.regular_revenue + report.regular.revenue_cents,
      total_sold: acc.total_sold + report.totals.sold,
      total_capacity: acc.total_capacity + report.totals.capacity,
      total_revenue: acc.total_revenue + report.totals.revenue_cents,
    }),
    {
      vip_sold: 0,
      vip_capacity: 0,
      vip_revenue: 0,
      regular_sold: 0,
      regular_capacity: 0,
      regular_revenue: 0,
      total_sold: 0,
      total_capacity: 0,
      total_revenue: 0,
    }
  );

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Sales Reports</h1>
        <div>
          <button onClick={loadReports} className="btn" style={{ marginRight: '0.5rem' }}>
            Refresh
          </button>
          <button onClick={exportToCSV} className="btn btn-primary" disabled={reports.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      <Link to="/admin/events" style={{ marginBottom: '1rem', display: 'block' }}>
        ← Back to Events
      </Link>

      {error && (
        <Toast
          message={error}
          type="error"
          onClose={() => setError(null)}
        />
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left' }} rowSpan={2}>
                  Event
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }} colSpan={4}>
                  VIP
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }} colSpan={4}>
                  Regular
                </th>
                <th style={{ padding: '0.75rem', textAlign: 'center' }} colSpan={4}>
                  Totals
                </th>
              </tr>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Sold</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Capacity</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Remaining</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Revenue</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Sold</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Capacity</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Remaining</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Revenue</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Sold</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Capacity</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Remaining</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.event_id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <strong>{report.event_name}</strong>
                    <br />
                    <small style={{ color: '#666' }}>ID: {report.event_id}</small>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{report.vip.sold}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{report.vip.capacity}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{report.vip.remaining}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {formatCurrency(report.vip.revenue_cents)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{report.regular.sold}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{report.regular.capacity}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>{report.regular.remaining}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    {formatCurrency(report.regular.revenue_cents)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{report.totals.sold}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{report.totals.capacity}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{report.totals.remaining}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{formatCurrency(report.totals.revenue_cents)}</strong>
                  </td>
                </tr>
              ))}
              {reports.length > 0 && (
                <tr style={{ borderTop: '2px solid #ddd', backgroundColor: '#f5f5f5' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <strong>Grand Totals</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{grandTotals.vip_sold}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{grandTotals.vip_capacity}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{grandTotals.vip_capacity - grandTotals.vip_sold}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{formatCurrency(grandTotals.vip_revenue)}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{grandTotals.regular_sold}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{grandTotals.regular_capacity}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{grandTotals.regular_capacity - grandTotals.regular_sold}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{formatCurrency(grandTotals.regular_revenue)}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{grandTotals.total_sold}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{grandTotals.total_capacity}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{grandTotals.total_capacity - grandTotals.total_sold}</strong>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <strong>{formatCurrency(grandTotals.total_revenue)}</strong>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}




