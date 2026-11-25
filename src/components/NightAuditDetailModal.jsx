import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building,
  User,
  Search,
  DollarSign,
  TrendingUp,
  Percent,
  Receipt
} from 'lucide-react';
import { formatCurrency, formatDisplayDate } from '../services/nightAuditEngine';
import { getTodayIsoDate, getNextDayIsoDate } from '../services/dateUtils';

export default function NightAuditDetailModal({
  isOpen,
  onClose,
  auditRecord,
  property = {}
}) {
  const [activeTab, setActiveTab] = useState('summary');
  const [searchQuery, setSearchQuery] = useState('');
  const [printFormat, setPrintFormat] = useState('a4'); // 'a4' | 'thermal'

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !auditRecord) return null;

  const displayDate = auditRecord.date || formatDisplayDate(auditRecord.auditDate) || formatDisplayDate(getTodayIsoDate());
  const newDate = auditRecord.newBusinessDate || formatDisplayDate(auditRecord.newBusinessDateIso) || formatDisplayDate(getNextDayIsoDate(auditRecord.auditDate || getTodayIsoDate()));
  const performedBy = auditRecord.performedBy || auditRecord.startedBy || 'System';
  const completedTime = auditRecord.completedTime || auditRecord.completedAt || (auditRecord.performedAt ? `${formatDisplayDate(auditRecord.performedAt)} ${new Date(auditRecord.performedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : `${displayDate} 01:00 AM`);

  const kpis = auditRecord.kpis || {
    totalRooms: auditRecord.roomStatus?.total || 4,
    sellableRooms: auditRecord.roomStatus?.total || 4,
    occupiedRooms: auditRecord.roomStatus?.occupied || 1,
    vacantRooms: auditRecord.roomStatus?.vacant || 3,
    blockedRooms: auditRecord.roomStatus?.blocked || 0,
    occupancyPercent: auditRecord.occupancyPercent || 25,
    adr: auditRecord.adr || 2500,
    revpar: auditRecord.revpar || 625,
    totalRoomRevenue: auditRecord.totalRoomTariff || 2500
  };

  const rawRoomCharges = auditRecord.roomCharges || [];
  const filteredRoomCharges = searchQuery.trim()
    ? rawRoomCharges.filter(
        (rc) =>
          (rc.room || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (rc.guest || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (rc.folio || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : rawRoomCharges;

  const totalTariff = rawRoomCharges.reduce((acc, r) => acc + (Number(r.ofrdTariff) || 0), 0);
  const totalCGST = rawRoomCharges.reduce((acc, r) => acc + (Number(r.cgst) || 0), 0);
  const totalSGST = rawRoomCharges.reduce((acc, r) => acc + (Number(r.sgst) || 0), 0);
  const totalRentSum = rawRoomCharges.reduce((acc, r) => acc + (Number(r.totalRent) || 0), 0);

  const checkedOutList = auditRecord.checkedOutList || [];
  const paxStatus = auditRecord.paxStatus || [
    { status: 'Arrived', rooms: 0, adult: 0, child: 0 },
    { status: 'Checked Out', rooms: checkedOutList.length, adult: checkedOutList.length, child: 0 },
    { status: 'Stayover', rooms: rawRoomCharges.length, adult: rawRoomCharges.length, child: 0 }
  ];

  const outletRevenues = auditRecord.outletRevenues || {
    roomRent: { name: 'Front Office / Rooms', amount: totalTariff },
    restaurant: { name: 'Restaurant / F&B', amount: 0 },
    roomService: { name: 'Room Service', amount: 0 },
    laundry: { name: 'Laundry', amount: 0 },
    spa: { name: 'Spa & Wellness', amount: 0 },
    extraCharges: { name: 'Extra Charges', amount: 0 }
  };

  const collections = auditRecord.collections || {
    cash: { name: 'Cash', amount: totalRentSum },
    upi: { name: 'UPI / QR', amount: 0 },
    card: { name: 'Card', amount: 0 },
    bankTransfer: { name: 'Bank Transfer', amount: 0 },
    cityLedger: { name: 'City Ledger', amount: 0 }
  };

  // CSV Export for Room Charges & GST Register
  const handleExportCSV = () => {
    if (rawRoomCharges.length === 0) {
      alert('No room charges to export.');
      return;
    }

    const headers = [
      'Room',
      'Folio No',
      'Guest Name',
      'Rack Tariff (INR)',
      'Offered Tariff (INR)',
      'CGST (INR)',
      'SGST (INR)',
      'Total Rent (INR)',
      'Manager Note'
    ];

    const rows = rawRoomCharges.map((r) => [
      `"${r.room || ''}"`,
      `"${r.folio || ''}"`,
      `"${r.guest || ''}"`,
      (r.nrmlTariff || 0).toFixed(2),
      (r.ofrdTariff || 0).toFixed(2),
      (r.cgst || 0).toFixed(2),
      (r.sgst || 0).toFixed(2),
      (r.totalRent || 0).toFixed(2),
      `"${r.note || ''}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Night_Audit_${displayDate.replace(/\s+/g, '_')}_Room_Charges_GST.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = (mode = 'a4') => {
    setPrintFormat(mode);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="na-modal-overlay" onClick={onClose}>
      <div
        className={`na-modal-box ${printFormat === 'thermal' ? 'thermal-80mm' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Printable Letterhead (visible in @media print) */}
        <div className="na-print-header" style={{ display: 'none' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '18pt' }}>{property.name || 'HOTEL NIVASA'}</h2>
          <p style={{ margin: '0 0 6px', fontSize: '10pt', color: '#555' }}>
            Daily Manager's Night Audit Closing Report • Business Date: {displayDate}
          </p>
          <div style={{ fontSize: '9pt', color: '#666' }}>
            Generated By: {performedBy} • Advanced Date to: {newDate}
          </div>
        </div>

        {/* Modal Header */}
        <div className="na-modal-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Receipt size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                Night Audit Record — {displayDate}
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                Closed by <strong>{performedBy}</strong> on {completedTime} • Next Day: <strong>{newDate}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="na-btn-action primary"
              onClick={handleExportCSV}
              title="Download Room Charges & GST Register as CSV"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              className="na-btn-action primary"
              onClick={() => handlePrint('a4')}
              title="Print A4 Manager's Daily Report"
            >
              <Printer size={14} />
              <span>Print A4</span>
            </button>

            <button
              type="button"
              className="na-btn-action"
              style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1' }}
              onClick={() => handlePrint('thermal')}
              title="Print 80mm Thermal Receipt"
            >
              <Printer size={14} />
              <span>80mm Thermal</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                padding: '4px',
                marginLeft: '4px'
              }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="na-modal-tabs no-print">
          <button
            type="button"
            className={`na-modal-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary & KPIs
          </button>
          <button
            type="button"
            className={`na-modal-tab-btn ${activeTab === 'charges' ? 'active' : ''}`}
            onClick={() => setActiveTab('charges')}
          >
            Room Charges ({rawRoomCharges.length})
          </button>
          <button
            type="button"
            className={`na-modal-tab-btn ${activeTab === 'checkedOut' ? 'active' : ''}`}
            onClick={() => setActiveTab('checkedOut')}
          >
            Checked Out ({checkedOutList.length})
          </button>
          <button
            type="button"
            className={`na-modal-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Inventory & Shift
          </button>
        </div>

        {/* Modal Body */}
        <div className="na-modal-body">
          {/* TAB 1: SUMMARY & KPIS */}
          {activeTab === 'summary' && (
            <div>
              {/* Top KPI Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '0.85rem',
                  marginBottom: '1.5rem'
                }}
              >
                <div className="na-kpi-box">
                  <div className="na-kpi-label">Occupancy %</div>
                  <div className="na-kpi-val" style={{ color: '#2563eb' }}>
                    {kpis.occupancyPercent}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {kpis.occupiedRooms} / {kpis.sellableRooms} Rooms
                  </div>
                </div>

                <div className="na-kpi-box">
                  <div className="na-kpi-label">ADR (Avg Daily Rate)</div>
                  <div className="na-kpi-val">{formatCurrency(kpis.adr)}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Excl. GST</div>
                </div>

                <div className="na-kpi-box">
                  <div className="na-kpi-label">RevPAR</div>
                  <div className="na-kpi-val">{formatCurrency(kpis.revpar)}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Per Sellable Room</div>
                </div>

                <div className="na-kpi-box">
                  <div className="na-kpi-label">Room Tariff Posted</div>
                  <div className="na-kpi-val" style={{ color: '#16a34a' }}>
                    {formatCurrency(totalTariff)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{rawRoomCharges.length} Folios</div>
                </div>

                <div className="na-kpi-box">
                  <div className="na-kpi-label">Total GST Collected</div>
                  <div className="na-kpi-val">{formatCurrency(totalCGST + totalSGST)}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    CGST {formatCurrency(totalCGST)} • SGST {formatCurrency(totalSGST)}
                  </div>
                </div>
              </div>

              {/* Departmental & Collections Summary */}
              <div className="na-recon-grid">
                <div className="na-recon-card">
                  <div className="na-recon-card-title">
                    <span>Revenue by Department</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>Daily Ledger</span>
                  </div>
                  <div className="na-recon-list">
                    {Object.values(outletRevenues).map((out, idx) => (
                      <div key={idx} className="na-recon-row">
                        <span>{out.name}</span>
                        <strong>{formatCurrency(out.amount)}</strong>
                      </div>
                    ))}
                    <div className="na-recon-total-bar">
                      <span>Total Revenue</span>
                      <strong style={{ color: '#16a34a' }}>{formatCurrency(totalRentSum)}</strong>
                    </div>
                  </div>
                </div>

                <div className="na-recon-card">
                  <div className="na-recon-card-title">
                    <span>Collections by Mode</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>Reconciled</span>
                  </div>
                  <div className="na-recon-list">
                    {Object.values(collections).map((col, idx) => (
                      <div key={idx} className="na-recon-row">
                        <span>{col.name}</span>
                        <strong>{formatCurrency(col.amount)}</strong>
                      </div>
                    ))}
                    <div className="na-recon-total-bar">
                      <span>Total Collected</span>
                      <strong style={{ color: '#2563eb' }}>{formatCurrency(totalRentSum)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pax Movement Summary */}
              <div style={{ marginTop: '1.25rem' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#1e293b' }}>
                  Guest / Pax Movement
                </h4>
                <div className="na-table-wrap">
                  <table className="na-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Rooms</th>
                        <th style={{ textAlign: 'center' }}>Adults</th>
                        <th style={{ textAlign: 'center' }}>Children</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paxStatus.map((p, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{p.status}</td>
                          <td style={{ textAlign: 'center' }}>{p.rooms}</td>
                          <td style={{ textAlign: 'center' }}>{p.adult}</td>
                          <td style={{ textAlign: 'center' }}>{p.child}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ROOM CHARGES & GST REGISTER */}
          {activeTab === 'charges' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }} className="no-print">
                <div style={{ position: 'relative', width: 300 }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search by room, guest, folio..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Showing <strong>{filteredRoomCharges.length}</strong> of {rawRoomCharges.length} entries
                </div>
              </div>

              <div className="na-table-wrap">
                <table className="na-table">
                  <thead>
                    <tr>
                      <th>Room</th>
                      <th>Folio</th>
                      <th>Guest</th>
                      <th style={{ textAlign: 'right' }}>Rack Rate</th>
                      <th style={{ textAlign: 'right' }}>Offered Tariff</th>
                      <th style={{ textAlign: 'right' }}>CGST</th>
                      <th style={{ textAlign: 'right' }}>SGST</th>
                      <th style={{ textAlign: 'right' }}>Total Rent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoomCharges.length === 0 ? (
                      <tr>
                        <td colSpan={8}>
                          <div className="na-empty-state">
                            <div className="na-empty-icon">
                              <Receipt size={20} />
                            </div>
                            <p style={{ margin: 0, fontWeight: 600 }}>No stayover room charges recorded</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRoomCharges.map((rc, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{rc.room}</td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#2563eb' }}>
                              {rc.folio}
                            </span>
                          </td>
                          <td>{rc.guest}</td>
                          <td style={{ textAlign: 'right', color: '#64748b' }}>
                            {formatCurrency(rc.nrmlTariff)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(rc.ofrdTariff)}
                          </td>
                          <td style={{ textAlign: 'right', color: '#d97706' }}>
                            {formatCurrency(rc.cgst)}
                          </td>
                          <td style={{ textAlign: 'right', color: '#d97706' }}>
                            {formatCurrency(rc.sgst)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                            {formatCurrency(rc.totalRent)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredRoomCharges.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                        <td colSpan={4}>Total ({filteredRoomCharges.length} Folios)</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(totalTariff)}</td>
                        <td style={{ textAlign: 'right', color: '#d97706' }}>{formatCurrency(totalCGST)}</td>
                        <td style={{ textAlign: 'right', color: '#d97706' }}>{formatCurrency(totalSGST)}</td>
                        <td style={{ textAlign: 'right', color: '#16a34a' }}>{formatCurrency(totalRentSum)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: CHECKED OUT LIST */}
          {activeTab === 'checkedOut' && (
            <div>
              <div className="na-table-wrap">
                <table className="na-table">
                  <thead>
                    <tr>
                      <th>Room</th>
                      <th>Folio</th>
                      <th>Guest</th>
                      <th>Stay Dates</th>
                      <th style={{ textAlign: 'center' }}>Nights</th>
                      <th style={{ textAlign: 'right' }}>Room Charges</th>
                      <th style={{ textAlign: 'right' }}>Tax</th>
                      <th style={{ textAlign: 'right' }}>Payment</th>
                      <th style={{ textAlign: 'right' }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkedOutList.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <div className="na-empty-state">
                            <div className="na-empty-icon">
                              <User size={20} />
                            </div>
                            <p style={{ margin: 0, fontWeight: 600 }}>No departures occurred on this business date</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      checkedOutList.map((co, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{co.room}</td>
                          <td style={{ fontFamily: 'monospace', color: '#2563eb' }}>{co.folio}</td>
                          <td>{co.guest}</td>
                          <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            {co.arrival} → {co.departure}
                          </td>
                          <td style={{ textAlign: 'center' }}>{co.nights}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(co.roomCharges)}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(co.tax)}</td>
                          <td style={{ textAlign: 'right', color: '#16a34a' }}>{formatCurrency(co.payment)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: co.balance > 0 ? '#dc2626' : '#16a34a' }}>
                            {formatCurrency(co.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: INVENTORY & SHIFT OVERVIEW */}
          {activeTab === 'overview' && (
            <div>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: '#1e293b' }}>
                Physical Room Inventory Breakdown
              </h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '0.85rem',
                  marginBottom: '1.5rem'
                }}
              >
                <div className="na-kpi-box">
                  <div className="na-kpi-label">Total Rooms</div>
                  <div className="na-kpi-val">{kpis.totalRooms}</div>
                </div>
                <div className="na-kpi-box">
                  <div className="na-kpi-label">Occupied</div>
                  <div className="na-kpi-val" style={{ color: '#2563eb' }}>
                    {kpis.occupiedRooms}
                  </div>
                </div>
                <div className="na-kpi-box">
                  <div className="na-kpi-label">Vacant</div>
                  <div className="na-kpi-val" style={{ color: '#16a34a' }}>
                    {kpis.vacantRooms}
                  </div>
                </div>
                <div className="na-kpi-box">
                  <div className="na-kpi-label">Blocked / OOO</div>
                  <div className="na-kpi-val" style={{ color: '#ea580c' }}>
                    {kpis.blockedRooms}
                  </div>
                </div>
                <div className="na-kpi-box">
                  <div className="na-kpi-label">Departed Today</div>
                  <div className="na-kpi-val">{checkedOutList.length}</div>
                </div>
              </div>

              {auditRecord.managerNotes && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#1e293b' }}>
                    Manager's Audit Notes
                  </h4>
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '1rem',
                      fontSize: '0.86rem',
                      lineHeight: 1.5,
                      color: '#334155'
                    }}
                  >
                    {auditRecord.managerNotes}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
