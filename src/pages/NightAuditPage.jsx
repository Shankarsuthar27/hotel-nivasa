import React, { useState, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Play,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Percent,
  BedDouble,
  UserCheck,
  UserX,
  FileText,
  Printer,
  Download,
  ShieldCheck,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Lock
} from 'lucide-react';
import { pmsStore } from '../services/pmsStore';
import { getTodayIsoDate, getNextDayIsoDate } from '../services/dateUtils';
import {
  formatCurrency,
  formatDisplayDate,
  calculateIndianRoomGST,
  calculateNightAuditKPIs,
  scanPendingArrivals,
  scanDueDepartures,
  scanShiftReconciliation,
  scanDiscrepancies,
  scanStayoverFolios,
  executeNightAuditAtomic
} from '../services/nightAuditEngine';
import NightAuditDetailModal from '../components/NightAuditDetailModal';
import '../styles/night-audit.css';

export default function NightAuditPage({ onNavigate }) {
  // Live Store State
  const [storeState, setStoreState] = useState(() => pmsStore.getState());

  useEffect(() => {
    const unsub = pmsStore.subscribe((newState) => {
      setStoreState(newState);
    });
    return unsub;
  }, []);

  const property = storeState.property || {};
  const todayDefault = useMemo(() => getTodayIsoDate(), []);
  const currentBusinessDate = property.businessDate || todayDefault;
  const reservations = storeState.reservations || [];
  const rooms = storeState.rooms || [];
  const folios = storeState.folios || {};
  const nightAudits = storeState.nightAudits || [];

  // Automatically ensure business date aligns with current operational date
  useEffect(() => {
    const liveToday = getTodayIsoDate();
    if (!property.businessDate || property.businessDate < liveToday) {
      pmsStore.setBusinessDate(liveToday);
    }
  }, [property.businessDate]);

  // Live Digital Clock & Calendar Date
  const [systemTime, setSystemTime] = useState(() => {
    return new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  });

  const [systemDate, setSystemDate] = useState(() => {
    return new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setSystemTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      );
      setSystemDate(
        now.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSetCurrentDate = () => {
    const today = getTodayIsoDate();
    pmsStore.setBusinessDate(today);
  };

  // Wizard State: 0 = Dashboard/History view; 1..5 = Guided 5-Step Wizard
  const [activeStep, setActiveStep] = useState(0);
  const isWizardOpen = activeStep >= 1 && activeStep <= 5;

  // Modals & Inspection
  const [selectedAuditRecord, setSelectedAuditRecord] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Step 4 Editable Stayover Charges
  const [stayoverCharges, setStayoverCharges] = useState([]);
  const [editingChargeIndex, setEditingChargeIndex] = useState(null);
  const [overrideRateInput, setOverrideRateInput] = useState('');
  const [overrideReasonInput, setOverrideReasonInput] = useState('');
  const [confirmRollover, setConfirmRollover] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [completedRecord, setCompletedRecord] = useState(null);

  // Check if Today's Audit is Already Completed (Idempotency)
  const isTodayAuditCompleted = useMemo(() => {
    return (nightAudits || []).some(
      (a) =>
        (a.auditDate === currentBusinessDate || a.date?.includes(formatDisplayDate(currentBusinessDate))) &&
        (a.status === 'COMPLETED' || a.statusText === 'Completed')
    );
  }, [nightAudits, currentBusinessDate]);

  // Scanners for Step 1, 2, 3, 4
  const pendingArrivals = useMemo(
    () => scanPendingArrivals(reservations, currentBusinessDate),
    [reservations, currentBusinessDate]
  );

  const dueDepartures = useMemo(
    () => scanDueDepartures(reservations, currentBusinessDate, folios),
    [reservations, currentBusinessDate, folios]
  );

  const reconciliation = useMemo(
    () => scanShiftReconciliation(folios, reservations, currentBusinessDate),
    [folios, reservations, currentBusinessDate]
  );

  const discrepancies = useMemo(
    () => scanDiscrepancies(reservations, rooms, folios),
    [reservations, rooms, folios]
  );

  // Initialize or re-scan Stayover Charges when entering Step 4
  useEffect(() => {
    if (activeStep === 4 && stayoverCharges.length === 0) {
      const scanned = scanStayoverFolios(reservations, rooms, folios, currentBusinessDate);
      setStayoverCharges(scanned);
    }
  }, [activeStep, reservations, rooms, folios, currentBusinessDate]);

  // Step 1 Blocker count
  const step1BlockersCount = pendingArrivals.length + dueDepartures.length;
  const canProceedFromStep1 = step1BlockersCount === 0;

  // Step 4 Financial Sums
  const step4TotalTariff = useMemo(() => {
    return stayoverCharges.reduce((acc, c) => acc + (Number(c.offeredTariff) || 0), 0);
  }, [stayoverCharges]);

  const step4TotalCGST = useMemo(() => {
    return stayoverCharges.reduce((acc, c) => acc + (Number(c.cgstAmount) || 0), 0);
  }, [stayoverCharges]);

  const step4TotalSGST = useMemo(() => {
    return stayoverCharges.reduce((acc, c) => acc + (Number(c.sgstAmount) || 0), 0);
  }, [stayoverCharges]);

  const step4TotalRent = useMemo(() => {
    return Math.round((step4TotalTariff + step4TotalCGST + step4TotalSGST) * 100) / 100;
  }, [step4TotalTariff, step4TotalCGST, step4TotalSGST]);

  // Step 4 Projected KPIs
  const step4KPIs = useMemo(() => {
    return calculateNightAuditKPIs({
      rooms,
      occupiedRooms: stayoverCharges.length,
      totalRoomTariffExclTax: step4TotalTariff
    });
  }, [rooms, stayoverCharges.length, step4TotalTariff]);

  // -------------------------------------------------------------------------
  // Handlers for Step 1 Actions
  // -------------------------------------------------------------------------
  const handleCheckInGuest = (resId, assignedRoom) => {
    const ok = pmsStore.checkInReservation(resId, assignedRoom);
    if (!ok) {
      alert('Could not check in reservation. Please verify room availability.');
    }
  };

  const handleMarkNoShow = (resId) => {
    const postRetention = window.confirm(
      'Mark reservation as NO-SHOW?\n\nClick OK to mark as No-Show. The allocated room will be released.'
    );
    if (!postRetention) return;
    pmsStore.markReservationNoShow(resId);
  };

  const handleCancelBooking = (resId) => {
    if (window.confirm('Are you sure you want to cancel this pending arrival?')) {
      pmsStore.cancelReservation(resId, 'Cancelled during Night Audit');
    }
  };

  const handleProcessAllNoShows = () => {
    if (pendingArrivals.length === 0) return;
    if (
      window.confirm(
        `Process all ${pendingArrivals.length} pending arrivals as NO-SHOW?\nThis will release their rooms.`
      )
    ) {
      pendingArrivals.forEach((pa) => {
        pmsStore.markReservationNoShow(pa.id);
      });
    }
  };

  const handleSettleAndCheckout = (resId, folioId, balanceDue) => {
    if (balanceDue > 0.05 && folioId) {
      // Settle folio balance first
      pmsStore.settleFolio(resId, 'CASH', 'AUDIT-SETTLE', currentBusinessDate, balanceDue);
    }
    const res = pmsStore.checkOutReservation(resId);
    if (res && res.success === false) {
      alert(`Checkout failed: ${res.message}`);
    }
  };

  const handleExtendStayOneNight = (resId, currentCheckOut) => {
    const nextOut = getNextDayIsoDate(currentCheckOut);
    pmsStore.updateReservation(resId, { checkOutDate: nextOut });
  };

  // -------------------------------------------------------------------------
  // Handlers for Step 3 Discrepancies
  // -------------------------------------------------------------------------
  const handleAssignRoom = (resId, roomId) => {
    pmsStore.checkInReservation(resId, roomId);
  };

  const handleMarkComplimentary = (resId) => {
    pmsStore.updateReservation(resId, { isComplimentary: true, baseRatePerNight: 0 });
  };

  const handleFixHousekeepingSync = (roomId) => {
    pmsStore.setRoomStatus(roomId, 'clean');
  };

  // -------------------------------------------------------------------------
  // Handlers for Step 4 Rate Overrides & Atomic Execution
  // -------------------------------------------------------------------------
  const handleOpenRateOverride = (index) => {
    setEditingChargeIndex(index);
    setOverrideRateInput(stayoverCharges[index].offeredTariff);
    setOverrideReasonInput(stayoverCharges[index].managerOverrideNote || '');
  };

  const handleSaveRateOverride = () => {
    if (editingChargeIndex === null) return;
    const newRate = Number(overrideRateInput);
    if (isNaN(newRate) || newRate < 0) {
      alert('Please enter a valid numeric rate.');
      return;
    }
    if (!overrideReasonInput.trim()) {
      alert('Mandatory reason note is required for manager rate override.');
      return;
    }

    const gst = calculateIndianRoomGST(newRate);
    setStayoverCharges((prev) => {
      const copy = [...prev];
      copy[editingChargeIndex] = {
        ...copy[editingChargeIndex],
        offeredTariff: newRate,
        cgstRate: gst.cgstRate,
        sgstRate: gst.sgstRate,
        cgstAmount: gst.cgstAmount,
        sgstAmount: gst.sgstAmount,
        totalTaxAmount: gst.totalTaxAmount,
        totalRent: gst.totalRent,
        managerOverrideNote: overrideReasonInput.trim()
      };
      return copy;
    });

    setEditingChargeIndex(null);
    setOverrideRateInput('');
    setOverrideReasonInput('');
  };

  const handleExecuteAudit = async () => {
    if (!confirmRollover) {
      alert('Please check the confirmation box before executing the night audit.');
      return;
    }

    setIsExecuting(true);
    try {
      const result = await executeNightAuditAtomic({
        auditorName: 'Astha India',
        managerNotes: 'Daily end-of-day audit finalized.',
        stayoverCharges
      });

      if (!result.success) {
        alert(result.message);
        setIsExecuting(false);
        return;
      }

      setCompletedRecord(result.auditRecord);
      setActiveStep(5); // Advance to completion summary

      // Confetti celebration
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      console.error('Audit execution error:', err);
      alert(`Error during audit execution: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // Filtered Audit History
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return nightAudits;
    const term = historySearch.toLowerCase();
    return nightAudits.filter(
      (a) =>
        (a.date || '').toLowerCase().includes(term) ||
        (a.auditDate || '').toLowerCase().includes(term) ||
        (a.performedBy || '').toLowerCase().includes(term) ||
        (a.status || '').toLowerCase().includes(term)
    );
  }, [nightAudits, historySearch]);

  return (
    <div className="na-container">
      {/* ------------------------------------------------------------------ */}
      {/* 1. TOP BUSINESS DATE BANNER                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="na-banner">
        <div className="na-banner-header">
          <div className="na-banner-title-area">
            <div className="na-banner-icon">
              <Calendar size={26} />
            </div>
            <div>
              <h1 className="na-banner-title">
                Night Audit Console
                <span
                  className={`na-status-pill ${
                    isTodayAuditCompleted ? 'completed' : isWizardOpen ? 'running' : 'pending'
                  }`}
                >
                  {isTodayAuditCompleted
                    ? 'Day Closed'
                    : isWizardOpen
                    ? `Running (Step ${activeStep})`
                    : 'Audit Pending'}
                </span>
              </h1>
              <p className="na-banner-subtitle">
                Reconcile daily accounts, post nightly room rent & Indian GST, advance calendar by +1 day.
              </p>
            </div>
          </div>

          <div className="na-banner-actions">
            {!isWizardOpen && (
              <button
                type="button"
                className="na-btn-start"
                onClick={() => {
                  if (isTodayAuditCompleted) {
                    if (
                      !window.confirm(
                        `Audit for ${formatDisplayDate(currentBusinessDate)} is already completed.\nDo you want to review the audit wizard?`
                      )
                    ) {
                      return;
                    }
                  }
                  setActiveStep(1);
                }}
              >
                <Play size={16} />
                <span>{isTodayAuditCompleted ? 'Review Audit' : 'Start Night Audit'}</span>
              </button>
            )}

            {isWizardOpen && (
              <button
                type="button"
                className="na-btn-action"
                style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', padding: '0.6rem 1rem' }}
                onClick={() => setActiveStep(0)}
              >
                <ArrowLeft size={14} />
                <span>Exit Wizard</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Strip */}
        <div className="na-banner-stats-strip">
          <div className="na-stat-item">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
              <span className="na-stat-label" style={{ marginBottom: 0 }}>Current Business Date</span>
              <button
                type="button"
                onClick={handleSetCurrentDate}
                style={{
                  background: 'rgba(96, 165, 250, 0.15)',
                  border: '1px solid rgba(96, 165, 250, 0.4)',
                  color: '#93c5fd',
                  borderRadius: '4px',
                  padding: '2px 7px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
                title="Set or Sync Business Date to Live Current Date"
              >
                <RefreshCw size={10} />
                <span>Set Current Date</span>
              </button>
            </div>
            <span className="na-stat-val" style={{ color: '#60a5fa' }}>
              {formatDisplayDate(currentBusinessDate)}
            </span>
          </div>

          <div className="na-stat-item">
            <span className="na-stat-label">Live System Clock ({systemDate})</span>
            <span className="na-stat-val" style={{ fontFamily: 'monospace' }}>
              {systemTime}
            </span>
          </div>

          <div className="na-stat-item">
            <span className="na-stat-label">Pending Blockers</span>
            <span className="na-stat-val" style={{ color: step1BlockersCount > 0 ? '#fb923c' : '#4ade80' }}>
              {step1BlockersCount} Pending
            </span>
          </div>

          <div className="na-stat-item">
            <span className="na-stat-label">In-House Stayovers</span>
            <span className="na-stat-val">
              {reservations.filter((r) => r.status === 'in_house').length} Rooms
            </span>
          </div>

          <div className="na-stat-item">
            <span className="na-stat-label">Audit Engine Status</span>
            <span className="na-stat-val" style={{ color: '#4ade80', fontSize: '0.98rem' }}>
              {isTodayAuditCompleted ? '🔒 Locked & Saved' : '⚡ Ready'}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. 5-STEP GUIDED AUDIT WIZARD                                      */}
      {/* ------------------------------------------------------------------ */}
      {isWizardOpen && (
        <div className="na-wizard-card">
          {/* Step Navigation Bar */}
          <div className="na-wizard-nav">
            <button
              type="button"
              className={`na-wizard-step-btn ${activeStep === 1 ? 'active' : ''} ${
                canProceedFromStep1 ? 'completed' : 'blocked'
              }`}
              onClick={() => setActiveStep(1)}
            >
              <div className="na-step-num">{canProceedFromStep1 ? '✓' : '1'}</div>
              <div className="na-step-meta">
                <span className="na-step-title">1. Pending Res.</span>
                <span className="na-step-sub">
                  {step1BlockersCount === 0 ? 'Resolved' : `${step1BlockersCount} Blockers`}
                </span>
              </div>
            </button>

            <button
              type="button"
              className={`na-wizard-step-btn ${activeStep === 2 ? 'active' : ''} ${
                activeStep > 2 ? 'completed' : ''
              }`}
              onClick={() => canProceedFromStep1 && setActiveStep(2)}
              disabled={!canProceedFromStep1}
            >
              <div className="na-step-num">{activeStep > 2 ? '✓' : '2'}</div>
              <div className="na-step-meta">
                <span className="na-step-title">2. Shift Recon</span>
                <span className="na-step-sub">Outlets & Cashiers</span>
              </div>
            </button>

            <button
              type="button"
              className={`na-wizard-step-btn ${activeStep === 3 ? 'active' : ''} ${
                activeStep > 3 ? 'completed' : ''
              }`}
              onClick={() => canProceedFromStep1 && setActiveStep(3)}
              disabled={!canProceedFromStep1}
            >
              <div className="na-step-num">{activeStep > 3 ? '✓' : '3'}</div>
              <div className="na-step-meta">
                <span className="na-step-title">3. Discrepancies</span>
                <span className="na-step-sub">{discrepancies.length} Flagged</span>
              </div>
            </button>

            <button
              type="button"
              className={`na-wizard-step-btn ${activeStep === 4 ? 'active' : ''} ${
                activeStep > 4 ? 'completed' : ''
              }`}
              onClick={() => canProceedFromStep1 && setActiveStep(4)}
              disabled={!canProceedFromStep1}
            >
              <div className="na-step-num">{activeStep > 4 ? '✓' : '4'}</div>
              <div className="na-step-meta">
                <span className="na-step-title">4. Post Tariffs</span>
                <span className="na-step-sub">{stayoverCharges.length} Stayovers</span>
              </div>
            </button>

            <button
              type="button"
              className={`na-wizard-step-btn ${activeStep === 5 ? 'active' : ''}`}
              onClick={() => completedRecord && setActiveStep(5)}
              disabled={!completedRecord}
            >
              <div className="na-step-num">5</div>
              <div className="na-step-meta">
                <span className="na-step-title">5. Final Reports</span>
                <span className="na-step-sub">KPIs & Summary</span>
              </div>
            </button>
          </div>

          <div className="na-wizard-body">
            {/* -------------------------------------------------------------- */}
            {/* STEP 1: RESOLVE PENDING RESERVATIONS                           */}
            {/* -------------------------------------------------------------- */}
            {activeStep === 1 && (
              <div>
                <div className="na-section-header">
                  <h2 className="na-section-title">Step 1 — Resolve Pending Reservations (Pre-Audit Blockers)</h2>
                  <p className="na-section-desc">
                    All arrivals and due-out departures scheduled for today must be resolved before proceeding.
                  </p>
                </div>

                {!canProceedFromStep1 ? (
                  <div className="na-alert-box danger">
                    <AlertTriangle size={20} className="na-alert-icon" />
                    <div>
                      <div className="na-alert-title">{step1BlockersCount} Pre-Audit Blockers Remaining</div>
                      <div className="na-alert-text">
                        Check in pending arrivals, mark no-shows, or check out due departures. The wizard cannot
                        proceed until all blockers are cleared.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="na-alert-box success">
                    <CheckCircle2 size={20} className="na-alert-icon" />
                    <div>
                      <div className="na-alert-title">All Reservations Cleared!</div>
                      <div className="na-alert-text">
                        No pending arrivals or due departures remain for today. You are ready to proceed to Shift
                        Reconciliation.
                      </div>
                    </div>
                  </div>
                )}

                {/* Section A: Pending Arrivals */}
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>
                      Pending Arrivals Today ({pendingArrivals.length})
                    </h3>
                    {pendingArrivals.length > 0 && (
                      <button
                        type="button"
                        className="na-btn-action danger"
                        onClick={handleProcessAllNoShows}
                      >
                        <UserX size={14} />
                        <span>Process All as No-Show</span>
                      </button>
                    )}
                  </div>

                  <div className="na-table-wrap">
                    <table className="na-table">
                      <thead>
                        <tr>
                          <th>Booking Ref</th>
                          <th>Guest Name</th>
                          <th>Room</th>
                          <th>Check-In</th>
                          <th>Nights</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th style={{ textAlign: 'right' }}>Balance</th>
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingArrivals.length === 0 ? (
                          <tr>
                            <td colSpan={8}>
                              <div className="na-empty-state">
                                <CheckCircle2 size={24} style={{ color: '#16a34a', margin: '0 auto 6px' }} />
                                <p style={{ margin: 0, fontWeight: 600, color: '#166534' }}>
                                  No pending arrivals. All expected guests have checked in or were processed.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          pendingArrivals.map((pa) => (
                            <tr key={pa.id}>
                              <td style={{ fontWeight: 600, fontFamily: 'monospace', color: '#2563eb' }}>
                                {pa.bookingReference}
                              </td>
                              <td style={{ fontWeight: 600 }}>{pa.guestName}</td>
                              <td>{pa.roomNumber}</td>
                              <td>{formatDisplayDate(pa.checkInDate)}</td>
                              <td>{pa.nights}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(pa.totalAmount)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: pa.balanceDue > 0 ? '#dc2626' : '#16a34a' }}>
                                {formatCurrency(pa.balanceDue)}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="na-btn-action primary"
                                    onClick={() => handleCheckInGuest(pa.id, pa.roomId)}
                                    title="Check In Guest"
                                  >
                                    <UserCheck size={13} />
                                    <span>Check In</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="na-btn-action danger"
                                    onClick={() => handleMarkNoShow(pa.id)}
                                    title="Mark as No-Show"
                                  >
                                    <UserX size={13} />
                                    <span>No-Show</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="na-btn-action"
                                    style={{ background: '#f1f5f9', color: '#475569' }}
                                    onClick={() => handleCancelBooking(pa.id)}
                                    title="Cancel Reservation"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section B: Due Departures */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: '#1e293b' }}>
                    Due Departures Today ({dueDepartures.length})
                  </h3>

                  <div className="na-table-wrap">
                    <table className="na-table">
                      <thead>
                        <tr>
                          <th>Booking Ref</th>
                          <th>Guest Name</th>
                          <th>Room</th>
                          <th>Check-Out</th>
                          <th style={{ textAlign: 'right' }}>Folio Balance</th>
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dueDepartures.length === 0 ? (
                          <tr>
                            <td colSpan={6}>
                              <div className="na-empty-state">
                                <CheckCircle2 size={24} style={{ color: '#16a34a', margin: '0 auto 6px' }} />
                                <p style={{ margin: 0, fontWeight: 600, color: '#166534' }}>
                                  No due departures pending. All departing guests have checked out.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          dueDepartures.map((dd) => (
                            <tr key={dd.id}>
                              <td style={{ fontWeight: 600, fontFamily: 'monospace', color: '#2563eb' }}>
                                {dd.bookingReference}
                              </td>
                              <td style={{ fontWeight: 600 }}>{dd.guestName}</td>
                              <td>{dd.roomNumber}</td>
                              <td>{formatDisplayDate(dd.checkOutDate)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: dd.hasBalanceDue ? '#dc2626' : '#16a34a' }}>
                                {formatCurrency(dd.balanceDue)}
                                {dd.hasBalanceDue && (
                                  <span style={{ display: 'block', fontSize: '0.72rem', color: '#ea580c' }}>
                                    Unsettled Balance
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                  <button
                                    type="button"
                                    className="na-btn-action success"
                                    onClick={() => handleSettleAndCheckout(dd.id, dd.folioId, dd.balanceDue)}
                                    title={dd.hasBalanceDue ? 'Settle Balance & Check Out' : 'Check Out Guest'}
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>{dd.hasBalanceDue ? 'Settle & Checkout' : 'Checkout'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="na-btn-action primary"
                                    onClick={() => handleExtendStayOneNight(dd.id, dd.checkOutDate)}
                                    title="Extend stay by +1 night"
                                  >
                                    <span>Extend +1 Night</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="na-wizard-footer">
                  <button type="button" className="na-btn-nav prev" onClick={() => setActiveStep(0)}>
                    Back to Dashboard
                  </button>
                  <button
                    type="button"
                    className="na-btn-nav next"
                    onClick={() => setActiveStep(2)}
                    disabled={!canProceedFromStep1}
                  >
                    <span>Proceed to Shift Recon</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* STEP 2: DEPARTMENTAL & CASHIER RECONCILIATION                  */}
            {/* -------------------------------------------------------------- */}
            {activeStep === 2 && (
              <div>
                <div className="na-section-header">
                  <h2 className="na-section-title">Step 2 — Departmental & Cashier Shift Reconciliation</h2>
                  <p className="na-section-desc">
                    Reconcile today's department revenue across Front Office, F&B, and outlets against collected payments.
                  </p>
                </div>

                {reconciliation.unsettledCheckoutFolios.length > 0 && (
                  <div className="na-alert-box warning">
                    <AlertTriangle size={20} className="na-alert-icon" />
                    <div>
                      <div className="na-alert-title">
                        {reconciliation.unsettledCheckoutFolios.length} Unsettled Departure Folios Flagged
                      </div>
                      <div className="na-alert-text">
                        Some checked-out guests have open balances. Review and settle them below.
                      </div>
                    </div>
                  </div>
                )}

                <div className="na-recon-grid">
                  {/* Left Column: Revenue by Outlet */}
                  <div className="na-recon-card">
                    <div className="na-recon-card-title">
                      <span>Today's Revenue by Outlet</span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Accrued</span>
                    </div>
                    <div className="na-recon-list">
                      {Object.values(reconciliation.outlets).map((o, idx) => (
                        <div key={idx} className="na-recon-row">
                          <span>{o.name}</span>
                          <strong>{formatCurrency(o.amount)}</strong>
                        </div>
                      ))}
                      <div className="na-recon-total-bar">
                        <span>Total Revenue</span>
                        <strong style={{ color: '#16a34a' }}>{formatCurrency(reconciliation.totalRevenue)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Collections by Mode */}
                  <div className="na-recon-card">
                    <div className="na-recon-card-title">
                      <span>Today's Collections by Mode</span>
                      <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Received</span>
                    </div>
                    <div className="na-recon-list">
                      {Object.values(reconciliation.collections).map((c, idx) => (
                        <div key={idx} className="na-recon-row">
                          <span>{c.name}</span>
                          <strong>{formatCurrency(c.amount)}</strong>
                        </div>
                      ))}
                      <div className="na-recon-total-bar">
                        <span>Total Collected</span>
                        <strong style={{ color: '#2563eb' }}>{formatCurrency(reconciliation.totalCollections)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Unsettled Checkout Folios Table if any */}
                {reconciliation.unsettledCheckoutFolios.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: '#ea580c' }}>
                      Unsettled Checkout Folios
                    </h3>
                    <div className="na-table-wrap">
                      <table className="na-table">
                        <thead>
                          <tr>
                            <th>Folio</th>
                            <th>Guest</th>
                            <th>Room</th>
                            <th style={{ textAlign: 'right' }}>Balance Due</th>
                            <th style={{ textAlign: 'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reconciliation.unsettledCheckoutFolios.map((uc, idx) => (
                            <tr key={idx}>
                              <td style={{ fontFamily: 'monospace', color: '#2563eb' }}>{uc.folioId}</td>
                              <td>{uc.guestName}</td>
                              <td>{uc.roomNumber}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                                {formatCurrency(uc.balanceDue)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="na-btn-action primary"
                                  onClick={() => {
                                    pmsStore.settleFolio(
                                      uc.reservationId,
                                      'CASH',
                                      'SHIFT-SETTLE',
                                      currentBusinessDate,
                                      uc.balanceDue
                                    );
                                  }}
                                >
                                  Settle Folio
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="na-wizard-footer">
                  <button type="button" className="na-btn-nav prev" onClick={() => setActiveStep(1)}>
                    <ArrowLeft size={16} />
                    <span>Back to Pending Res</span>
                  </button>
                  <button type="button" className="na-btn-nav next" onClick={() => setActiveStep(3)}>
                    <span>Verify Discrepancies</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* STEP 3: VERIFY DISCREPANCIES                                   */}
            {/* -------------------------------------------------------------- */}
            {activeStep === 3 && (
              <div>
                <div className="na-section-header">
                  <h2 className="na-section-title">Step 3 — Verify Room & Rate Discrepancies</h2>
                  <p className="na-section-desc">
                    Scan for unassigned rooms, zero-tariff active folios, and housekeeping operational mismatches.
                  </p>
                </div>

                {discrepancies.length === 0 ? (
                  <div className="na-alert-box success">
                    <CheckCircle2 size={20} className="na-alert-icon" />
                    <div>
                      <div className="na-alert-title">Zero Discrepancies Detected</div>
                      <div className="na-alert-text">
                        All in-house reservations have physical rooms assigned, valid non-zero tariffs, and matching
                        housekeeping statuses.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="na-alert-box warning">
                    <AlertTriangle size={20} className="na-alert-icon" />
                    <div>
                      <div className="na-alert-title">{discrepancies.length} Operational Discrepancies Found</div>
                      <div className="na-alert-text">
                        Review the flagged discrepancies below before proceeding with the tariff posting.
                      </div>
                    </div>
                  </div>
                )}

                <div className="na-table-wrap">
                  <table className="na-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Guest / Room</th>
                        <th>Discrepancy Details</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discrepancies.length === 0 ? (
                        <tr>
                          <td colSpan={4}>
                            <div className="na-empty-state">
                              <CheckCircle2 size={24} style={{ color: '#16a34a', margin: '0 auto 6px' }} />
                              <p style={{ margin: 0, fontWeight: 600 }}>All room & rate checks passed clean!</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        discrepancies.map((disc) => (
                          <tr key={disc.id}>
                            <td>
                              <span
                                className={`na-status-pill ${
                                  disc.severity === 'high' ? 'pending' : 'running'
                                }`}
                              >
                                {disc.type.replace('_', ' ')}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {disc.guestName} {disc.roomNumber ? `(Room ${disc.roomNumber})` : ''}
                            </td>
                            <td>{disc.message}</td>
                            <td style={{ textAlign: 'center' }}>
                              {disc.actionType === 'ASSIGN_ROOM' && (
                                <select
                                  className="na-btn-action primary"
                                  onChange={(e) => {
                                    if (e.target.value) handleAssignRoom(disc.reservationId, e.target.value);
                                  }}
                                  defaultValue=""
                                >
                                  <option value="" disabled>
                                    Assign Room...
                                  </option>
                                  {rooms.map((rm) => (
                                    <option key={rm.id} value={rm.id}>
                                      Room {rm.roomNumber} ({rm.roomTypeId})
                                    </option>
                                  ))}
                                </select>
                              )}

                              {disc.actionType === 'FIX_RATE' && (
                                <button
                                  type="button"
                                  className="na-btn-action primary"
                                  onClick={() => handleMarkComplimentary(disc.reservationId)}
                                >
                                  Mark Complimentary
                                </button>
                              )}

                              {disc.actionType === 'SYNC_HOUSEKEEPING' && (
                                <button
                                  type="button"
                                  className="na-btn-action success"
                                  onClick={() => handleFixHousekeepingSync(disc.roomId)}
                                >
                                  Sync Clean Status
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="na-wizard-footer">
                  <button type="button" className="na-btn-nav prev" onClick={() => setActiveStep(2)}>
                    <ArrowLeft size={16} />
                    <span>Back to Shift Recon</span>
                  </button>
                  <button type="button" className="na-btn-nav next" onClick={() => setActiveStep(4)}>
                    <span>Preview Nightly Postings</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* STEP 4: PREVIEW & POST ROOM + GST CHARGES                      */}
            {/* -------------------------------------------------------------- */}
            {activeStep === 4 && (
              <div>
                <div className="na-section-header">
                  <h2 className="na-section-title">Step 4 — Preview & Post Nightly Room + GST Charges</h2>
                  <p className="na-section-desc">
                    Review and verify overnight room tariff postings and Indian GST (CGST + SGST) for stayover guests.
                  </p>
                </div>

                {/* KPI Projection Card */}
                <div className="na-kpi-projection">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>
                      Projected Daily KPIs for {formatDisplayDate(currentBusinessDate)}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Based on {stayoverCharges.length} Stayovers</span>
                  </div>

                  <div className="na-kpi-grid">
                    <div className="na-kpi-box">
                      <div className="na-kpi-label">Sellable Rooms</div>
                      <div className="na-kpi-val">{step4KPIs.sellableRooms}</div>
                    </div>
                    <div className="na-kpi-box">
                      <div className="na-kpi-label">Occupancy %</div>
                      <div className="na-kpi-val" style={{ color: '#2563eb' }}>
                        {step4KPIs.occupancyPercent}%
                      </div>
                    </div>
                    <div className="na-kpi-box">
                      <div className="na-kpi-label">Projected ADR</div>
                      <div className="na-kpi-val">{formatCurrency(step4KPIs.adr)}</div>
                    </div>
                    <div className="na-kpi-box">
                      <div className="na-kpi-label">Projected RevPAR</div>
                      <div className="na-kpi-val">{formatCurrency(step4KPIs.revpar)}</div>
                    </div>
                    <div className="na-kpi-box">
                      <div className="na-kpi-label">Room Tariff Revenue</div>
                      <div className="na-kpi-val" style={{ color: '#16a34a' }}>
                        {formatCurrency(step4TotalTariff)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stayover Postings Table */}
                <div className="na-table-wrap">
                  <table className="na-table">
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Folio No.</th>
                        <th>Guest</th>
                        <th style={{ textAlign: 'right' }}>Rack Rate</th>
                        <th style={{ textAlign: 'right' }}>Offered Tariff</th>
                        <th style={{ textAlign: 'right' }}>CGST</th>
                        <th style={{ textAlign: 'right' }}>SGST</th>
                        <th style={{ textAlign: 'right' }}>Total Rent</th>
                        <th style={{ textAlign: 'center' }}>Override</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stayoverCharges.length === 0 ? (
                        <tr>
                          <td colSpan={9}>
                            <div className="na-empty-state">
                              <p style={{ margin: 0, fontWeight: 600 }}>No stayover reservations found for tonight</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        stayoverCharges.map((chg, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>Room {chg.roomNumber}</td>
                            <td style={{ fontFamily: 'monospace', color: '#2563eb' }}>{chg.folioId}</td>
                            <td>
                              <div>{chg.guestName}</div>
                              {chg.managerOverrideNote && (
                                <div style={{ fontSize: '0.72rem', color: '#ea580c' }}>
                                  Note: {chg.managerOverrideNote}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', color: '#64748b' }}>
                              {formatCurrency(chg.rackTariff)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              {formatCurrency(chg.offeredTariff)}
                            </td>
                            <td style={{ textAlign: 'right', color: '#d97706' }}>
                              {formatCurrency(chg.cgstAmount)}
                              <span style={{ fontSize: '0.68rem', display: 'block', color: '#94a3b8' }}>
                                ({chg.cgstRate}%)
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', color: '#d97706' }}>
                              {formatCurrency(chg.sgstAmount)}
                              <span style={{ fontSize: '0.68rem', display: 'block', color: '#94a3b8' }}>
                                ({chg.sgstRate}%)
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                              {formatCurrency(chg.totalRent)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="na-btn-action primary"
                                onClick={() => handleOpenRateOverride(idx)}
                              >
                                Edit Rate
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                        <td colSpan={4}>Total to Post ({stayoverCharges.length} Folios)</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(step4TotalTariff)}</td>
                        <td style={{ textAlign: 'right', color: '#d97706' }}>{formatCurrency(step4TotalCGST)}</td>
                        <td style={{ textAlign: 'right', color: '#d97706' }}>{formatCurrency(step4TotalSGST)}</td>
                        <td style={{ textAlign: 'right', color: '#16a34a' }}>{formatCurrency(step4TotalRent)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Manager Rate Override Sub-Dialog */}
                {editingChargeIndex !== null && (
                  <div
                    style={{
                      background: '#fff7ed',
                      border: '1px solid #fed7aa',
                      borderRadius: '8px',
                      padding: '1rem',
                      marginBottom: '1.5rem'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem', color: '#9a3412' }}>
                      Manager Rate Override — Room {stayoverCharges[editingChargeIndex].roomNumber} ({stayoverCharges[editingChargeIndex].guestName})
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '0.75rem', alignItems: 'end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                          New Offered Tariff (₹)
                        </label>
                        <input
                          type="number"
                          className="form-input"
                          value={overrideRateInput}
                          onChange={(e) => setOverrideRateInput(e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                          Mandatory Override Reason Note *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Corporate discount agreement approved by GM"
                          value={overrideReasonInput}
                          onChange={(e) => setOverrideReasonInput(e.target.value)}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="na-btn-action success"
                          onClick={handleSaveRateOverride}
                        >
                          Save Override
                        </button>
                        <button
                          type="button"
                          className="na-btn-action"
                          style={{ background: '#f1f5f9' }}
                          onClick={() => setEditingChargeIndex(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Execution Confirmation Checkbox */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    marginBottom: '1.5rem'
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: '#0f172a'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={confirmRollover}
                      onChange={(e) => setConfirmRollover(e.target.checked)}
                      style={{ width: 18, height: 18, marginTop: 2 }}
                    />
                    <span>
                      I confirm all cashier drawers are balanced, all arrivals/departures are resolved, and rates
                      are verified. Post room tariff & GST and roll over business date forward by +1 day.
                    </span>
                  </label>
                </div>

                <div className="na-wizard-footer">
                  <button type="button" className="na-btn-nav prev" onClick={() => setActiveStep(3)}>
                    <ArrowLeft size={16} />
                    <span>Back to Discrepancies</span>
                  </button>
                  <button
                    type="button"
                    className="na-btn-nav next"
                    style={{ background: '#16a34a' }}
                    onClick={handleExecuteAudit}
                    disabled={!confirmRollover || isExecuting}
                  >
                    <Lock size={16} />
                    <span>{isExecuting ? 'Executing Night Audit...' : 'Execute Night Audit & Rollover Date'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* -------------------------------------------------------------- */}
            {/* STEP 5: POST-AUDIT REPORTS & ACTIONS                           */}
            {/* -------------------------------------------------------------- */}
            {activeStep === 5 && (
              <div>
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: '50%',
                      background: '#dcfce7',
                      color: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem'
                    }}
                  >
                    <CheckCircle2 size={36} />
                  </div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                    Night Audit Successfully Completed!
                  </h2>
                  <p style={{ fontSize: '0.95rem', color: '#64748b', maxWidth: 600, margin: '0 auto 1.5rem' }}>
                    Business date has advanced to{' '}
                    <strong style={{ color: '#2563eb' }}>
                      {formatDisplayDate(property.businessDate)}
                    </strong>
                    . Room tariffs and Indian GST have been posted to folios, and an immutable ledger snapshot has
                    been saved.
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="na-btn-start"
                      onClick={() => {
                        setSelectedAuditRecord(completedRecord || nightAudits[0]);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      <FileText size={16} />
                      <span>View Full Audit Details</span>
                    </button>

                    <button
                      type="button"
                      className="na-btn-nav prev"
                      onClick={() => {
                        setSelectedAuditRecord(completedRecord || nightAudits[0]);
                        setIsDetailModalOpen(true);
                        setTimeout(() => window.print(), 200);
                      }}
                    >
                      <Printer size={16} />
                      <span>Print Daily Manager Report</span>
                    </button>

                    <button
                      type="button"
                      className="na-btn-nav prev"
                      onClick={() => setActiveStep(0)}
                    >
                      <span>Return to Audit Console</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. AUDIT HISTORY TABLE                                             */}
      {/* ------------------------------------------------------------------ */}
      <div>
        <div className="na-history-header">
          <div>
            <h2 className="na-history-title">Audit History & Snapshots</h2>
            <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Immutable records of all past night audits and daily ledger roll-overs.
            </p>
          </div>

          <div style={{ position: 'relative', width: 280 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search history by date, user..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 32px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem'
              }}
            />
          </div>
        </div>

        <div className="na-table-wrap">
          <table className="na-table">
            <thead>
              <tr>
                <th>Audit Date</th>
                <th>New Business Date</th>
                <th>Completed Time</th>
                <th>Performed By</th>
                <th style={{ textAlign: 'center' }}>Folios Posted</th>
                <th style={{ textAlign: 'right' }}>Total Posted</th>
                <th style={{ textAlign: 'center' }}>Occupancy %</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="na-empty-state">
                      <Calendar size={24} style={{ color: '#94a3b8', margin: '0 auto 6px' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>No night audit history records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredHistory.map((rec) => {
                  const dispDate = rec.date || formatDisplayDate(rec.auditDate);
                  const newDate = rec.newBusinessDate || formatDisplayDate(rec.newBusinessDateIso) || '—';
                  const chargesCount = rec.chargesPostedCount ?? (rec.roomCharges ? rec.roomCharges.length : 0);
                  const totalAmt = rec.amountPosted ?? rec.totalRevenue ?? 0;
                  const occ = rec.occupancyPercent ?? (rec.kpis?.occupancyPercent) ?? 25;

                  return (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{dispDate}</td>
                      <td>{newDate}</td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{rec.completedTime || '—'}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{rec.performedBy || rec.startedBy || 'System'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>{chargesCount}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>
                        {formatCurrency(totalAmt)}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: '#2563eb' }}>
                        {occ}%
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="na-status-pill completed">COMPLETED</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="na-btn-action primary"
                          onClick={() => {
                            setSelectedAuditRecord(rec);
                            setIsDetailModalOpen(true);
                          }}
                        >
                          <span>View Details</span>
                          <ExternalLink size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drilldown Modal */}
      {isDetailModalOpen && selectedAuditRecord && (
        <NightAuditDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          auditRecord={selectedAuditRecord}
          property={property}
        />
      )}
    </div>
  );
}
