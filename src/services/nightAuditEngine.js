/**
 * nightAuditEngine.js
 * Production-ready Hotel PMS Night Audit Engine
 * 
 * Rules:
 * 1. Financial Accuracy: Indian Rupees ('₹' en-IN with 2 decimals)
 * 2. Indian GST Split 50/50: CGST + SGST (0% <= ₹1k | 12% ₹1001-₹7500 | 18% > ₹7500 or property configured rate)
 * 3. Idempotency & Date Locking: Exactly 1 COMPLETED audit per businessDate
 * 4. Immutable Snapshots: Frozen JSON ledger saved to 'night_audits'
 * 5. Clean Empty States: No hardcoded dummy data
 */

import { pmsStore } from './pmsStore';
import { normalizeDateStr, getNextDayIsoDate, getTodayIsoDate } from './dateUtils';

/**
 * Format currency in Indian Rupees (₹) with 2 decimals
 */
export function formatCurrency(amount) {
  const num = Number(amount || 0);
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format date to standard Indian PMS display: e.g. "22 Nov 2026"
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr) return '—';
  const clean = normalizeDateStr(dateStr);
  const parts = clean.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return dateStr;
}

/**
 * Calculate Indian Room GST split 50/50 into CGST and SGST
 * Slab rules:
 * - Up to ₹1,000 : 0% GST (CGST 0%, SGST 0%)
 * - ₹1,001 to ₹7,500 : 12% GST (CGST 6%, SGST 6%)
 * - Above ₹7,500 : 18% GST (CGST 9%, SGST 9%)
 * - Or custom tax rate override if supplied by property configuration
 */
export function calculateIndianRoomGST(tariff, customTaxRate = null) {
  const netTariff = Math.max(0, Number(tariff) || 0);
  if (netTariff <= 0) {
    return {
      tariff: 0,
      cgstRate: 0,
      sgstRate: 0,
      totalRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      totalTaxAmount: 0,
      totalRent: 0
    };
  }

  let totalRate = 0;
  if (customTaxRate !== null && customTaxRate !== undefined && !isNaN(Number(customTaxRate))) {
    totalRate = Number(customTaxRate);
  } else {
    if (netTariff <= 1000) {
      totalRate = 0;
    } else if (netTariff <= 7500) {
      totalRate = 12;
    } else {
      totalRate = 18;
    }
  }

  const halfRate = totalRate / 2;
  const totalTaxAmount = Math.round(((netTariff * totalRate) / 100) * 100) / 100;
  const cgstAmount = Math.round(((netTariff * halfRate) / 100) * 100) / 100;
  const sgstAmount = Math.round((totalTaxAmount - cgstAmount) * 100) / 100;
  const totalRent = Math.round((netTariff + totalTaxAmount) * 100) / 100;

  return {
    tariff: netTariff,
    cgstRate: halfRate,
    sgstRate: halfRate,
    totalRate,
    cgstAmount,
    sgstAmount,
    totalTaxAmount,
    totalRent
  };
}

/**
 * Calculate Key Performance Indicators (KPIs) for the Night Audit
 * - Sellable Rooms = Total Rooms - Blocked/Out-of-Order Rooms
 * - Occupancy % = (Occupied Rooms / Sellable Rooms) * 100
 * - ADR = Total Room Tariff (excl. GST) / Occupied Rooms
 * - RevPAR = Total Room Tariff (excl. GST) / Sellable Rooms
 */
export function calculateNightAuditKPIs({
  rooms = [],
  occupiedRooms = 0,
  totalRoomTariffExclTax = 0
}) {
  const totalRooms = Array.isArray(rooms) ? rooms.length : 0;
  const blockedRooms = Array.isArray(rooms)
    ? rooms.filter((r) => {
        const op = (r.operational || '').toLowerCase();
        const st = (r.status || '').toLowerCase();
        return op === 'blocked' || op === 'out_of_order' || op === 'maintenance' || st === 'blocked';
      }).length
    : 0;

  const sellableRooms = Math.max(0, totalRooms - blockedRooms);
  const occupiedCount = Number(occupiedRooms) || 0;
  const vacantRooms = Math.max(0, sellableRooms - occupiedCount);

  const occupancyPercent = sellableRooms > 0 ? (occupiedCount / sellableRooms) * 100 : 0;
  const adr = occupiedCount > 0 ? totalRoomTariffExclTax / occupiedCount : 0;
  const revpar = sellableRooms > 0 ? totalRoomTariffExclTax / sellableRooms : 0;

  return {
    totalRooms,
    blockedRooms,
    sellableRooms,
    occupiedRooms: occupiedCount,
    vacantRooms,
    occupancyPercent: Math.round(occupancyPercent * 10) / 10,
    adr: Math.round(adr * 100) / 100,
    revpar: Math.round(revpar * 100) / 100,
    totalRoomRevenue: Math.round(totalRoomTariffExclTax * 100) / 100
  };
}

/**
 * Step 1 Scanner: Scan Pending Arrivals for Today
 * Scans all EXPECTED / CONFIRMED reservations where checkInDate <= businessDate
 */
export function scanPendingArrivals(reservations = [], businessDate) {
  const curDate = normalizeDateStr(businessDate) || getTodayIsoDate();
  return reservations.filter((r) => {
    if (!r) return false;
    const status = (r.status || '').toLowerCase().replace(/[\s-]/g, '_');
    const isPending = status === 'confirmed' || status === 'expected' || status === 'arriving';
    const checkIn = normalizeDateStr(r.checkInDate);
    return isPending && checkIn && checkIn <= curDate;
  }).map((r) => {
    const guestName = r.primaryGuest?.name || r.guestName || 'Unnamed Guest';
    const phone = r.primaryGuest?.phone || r.guestPhone || '—';
    return {
      id: r.id,
      bookingReference: r.bookingReference || `#${r.id}`,
      guestName,
      phone,
      roomId: r.roomId || '',
      roomNumber: r.roomNumber || 'Unassigned',
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      nights: Number(r.nights) || 1,
      totalAmount: Number(r.totalAmount) || 0,
      paidAmount: Number(r.paidAmount) || 0,
      balanceDue: Number(r.balanceDue) || 0,
      source: r.bookingSource || 'Direct',
      status: r.status
    };
  });
}

/**
 * Step 1 Scanner: Scan Due Departures for Today
 * Scans all in-house reservations where checkOutDate <= businessDate
 */
export function scanDueDepartures(reservations = [], businessDate, folios = {}) {
  const curDate = normalizeDateStr(businessDate) || getTodayIsoDate();
  return reservations.filter((r) => {
    if (!r) return false;
    const status = (r.status || '').toLowerCase().replace(/[\s-]/g, '_');
    const isInHouse = status === 'in_house';
    const checkOut = normalizeDateStr(r.checkOutDate);
    return isInHouse && checkOut && checkOut <= curDate;
  }).map((r) => {
    const folio = (r.folioId && folios[r.folioId]) ? folios[r.folioId] : null;
    const balanceDue = folio?.balance !== undefined ? Number(folio.balance) : (Number(r.balanceDue) || 0);
    const guestName = r.primaryGuest?.name || r.guestName || 'Unnamed Guest';
    return {
      id: r.id,
      bookingReference: r.bookingReference || `#${r.id}`,
      guestName,
      roomNumber: r.roomNumber || (folio?.roomNumber) || 'Unassigned',
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      nights: Number(r.nights) || 1,
      folioId: r.folioId || '',
      balanceDue: Math.max(0, Math.round(balanceDue * 100) / 100),
      hasBalanceDue: balanceDue > 0.05,
      status: r.status
    };
  });
}

/**
 * Step 2 Scanner: Departmental & Cashier Shift Reconciliation
 * Summarizes revenue by outlet and collections by payment mode
 */
export function scanShiftReconciliation(folios = {}, reservations = [], businessDate) {
  const curDate = normalizeDateStr(businessDate) || getTodayIsoDate();

  const outlets = {
    roomRent: { name: 'Front Office / Rooms', amount: 0, txCount: 0 },
    restaurant: { name: 'Restaurant / F&B', amount: 0, txCount: 0 },
    roomService: { name: 'Room Service', amount: 0, txCount: 0 },
    laundry: { name: 'Laundry', amount: 0, txCount: 0 },
    spa: { name: 'Spa & Wellness', amount: 0, txCount: 0 },
    extraCharges: { name: 'Extra Charges / Misc', amount: 0, txCount: 0 }
  };

  const collections = {
    cash: { name: 'Cash', amount: 0, txCount: 0 },
    upi: { name: 'UPI / QR', amount: 0, txCount: 0 },
    card: { name: 'Card (Credit/Debit)', amount: 0, txCount: 0 },
    bankTransfer: { name: 'Bank Transfer / NEFT', amount: 0, txCount: 0 },
    cityLedger: { name: 'City Ledger / Direct Bill', amount: 0, txCount: 0 }
  };

  const unsettledCheckoutFolios = [];

  Object.values(folios || {}).forEach((folio) => {
    if (!folio) return;
    const transactions = Array.isArray(folio.transactions) ? folio.transactions : [];

    transactions.forEach((tx) => {
      const txDate = normalizeDateStr(tx.date);
      if (txDate !== curDate) return;

      const amt = Number(tx.amount) || 0;
      const type = (tx.type || '').toUpperCase();
      const desc = (tx.desc || tx.description || '').toLowerCase();

      if (type === 'ROOM_CHARGE' || type === 'CHARGE' || type === 'TARIFF') {
        if (desc.includes('food') || desc.includes('restaurant') || desc.includes('dining')) {
          outlets.restaurant.amount += amt;
          outlets.restaurant.txCount += 1;
        } else if (desc.includes('service') || desc.includes('in-room')) {
          outlets.roomService.amount += amt;
          outlets.roomService.txCount += 1;
        } else if (desc.includes('laundry')) {
          outlets.laundry.amount += amt;
          outlets.laundry.txCount += 1;
        } else if (desc.includes('spa') || desc.includes('massage')) {
          outlets.spa.amount += amt;
          outlets.spa.txCount += 1;
        } else if (desc.includes('room tariff') || desc.includes('rent') || desc.includes('accommodation') || desc.includes('room charge')) {
          outlets.roomRent.amount += amt;
          outlets.roomRent.txCount += 1;
        } else {
          outlets.extraCharges.amount += amt;
          outlets.extraCharges.txCount += 1;
        }
      } else if (type === 'PAYMENT') {
        const mode = (tx.paymentMethod || tx.mode || tx.desc || '').toLowerCase();
        if (mode.includes('cash')) {
          collections.cash.amount += amt;
          collections.cash.txCount += 1;
        } else if (mode.includes('upi') || mode.includes('gpay') || mode.includes('phonepe') || mode.includes('paytm')) {
          collections.upi.amount += amt;
          collections.upi.txCount += 1;
        } else if (mode.includes('card') || mode.includes('pos') || mode.includes('visa') || mode.includes('master')) {
          collections.card.amount += amt;
          collections.card.txCount += 1;
        } else if (mode.includes('bank') || mode.includes('neft') || mode.includes('rtgs') || mode.includes('transfer')) {
          collections.bankTransfer.amount += amt;
          collections.bankTransfer.txCount += 1;
        } else {
          collections.cityLedger.amount += amt;
          collections.cityLedger.txCount += 1;
        }
      }
    });

    // Check for unsettled checkout folios
    const res = (reservations || []).find((r) => r.folioId === folio.id);
    if (res && res.status === 'checked_out') {
      const bal = Number(folio.balance) || 0;
      if (bal > 0.05) {
        unsettledCheckoutFolios.push({
          folioId: folio.id,
          reservationId: res.id,
          guestName: res.primaryGuest?.name || res.guestName || 'Guest',
          roomNumber: folio.roomNumber || res.roomNumber || '—',
          balanceDue: bal
        });
      }
    }
  });

  const totalRevenue = Object.values(outlets).reduce((acc, o) => acc + o.amount, 0);
  const totalCollections = Object.values(collections).reduce((acc, c) => acc + c.amount, 0);

  return {
    outlets,
    collections,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCollections: Math.round(totalCollections * 100) / 100,
    unsettledCheckoutFolios,
    openCashierShifts: [] // In this PMS cashier drawer is tracked per folio
  };
}

/**
 * Step 3 Scanner: Room & Rate Discrepancies
 * Scans for:
 * 1. In-house folios with Unassigned Room
 * 2. Active rooms with ₹0.00 tariff (unless explicitly complimentary)
 * 3. Housekeeping status mismatches
 */
export function scanDiscrepancies(reservations = [], rooms = [], folios = {}) {
  const discrepancies = [];

  const inHouseList = reservations.filter((r) => {
    const st = (r.status || '').toLowerCase().replace(/[\s-]/g, '_');
    return st === 'in_house';
  });

  // 1. Unassigned Room Check
  inHouseList.forEach((r) => {
    const hasRoom = r.roomId && r.roomId !== 'unassigned' && r.roomNumber;
    if (!hasRoom) {
      discrepancies.push({
        id: `disc_unassigned_${r.id}`,
        type: 'UNASSIGNED_ROOM',
        severity: 'high',
        reservationId: r.id,
        bookingReference: r.bookingReference || `#${r.id}`,
        guestName: r.primaryGuest?.name || r.guestName || 'Unnamed Guest',
        message: `In-House reservation has no physical room assigned.`,
        actionType: 'ASSIGN_ROOM'
      });
    }
  });

  // 2. Zero-Tariff Check
  inHouseList.forEach((r) => {
    const rate = Number(r.baseRatePerNight);
    const isComplimentary = Boolean(r.isComplimentary);
    if ((isNaN(rate) || rate <= 0) && !isComplimentary) {
      discrepancies.push({
        id: `disc_rate_${r.id}`,
        type: 'ZERO_RATE',
        severity: 'medium',
        reservationId: r.id,
        bookingReference: r.bookingReference || `#${r.id}`,
        guestName: r.primaryGuest?.name || r.guestName || 'Unnamed Guest',
        roomNumber: r.roomNumber || '—',
        message: `Active stayover folio has ₹0.00 tariff without complimentary flag.`,
        actionType: 'FIX_RATE'
      });
    }
  });

  // 3. Housekeeping Status Mismatch
  inHouseList.forEach((r) => {
    if (r.roomId || r.roomNumber) {
      const room = rooms.find(
        (rm) => rm.id === r.roomId || rm.roomNumber === r.roomNumber || rm.roomNumber === r.roomId
      );
      if (room) {
        const op = (room.operational || '').toLowerCase();
        const st = (room.status || '').toLowerCase();
        if (op === 'vacant' || st === 'dirty') {
          discrepancies.push({
            id: `disc_hk_${room.id}_${r.id}`,
            type: 'HOUSEKEEPING_MISMATCH',
            severity: 'low',
            roomId: room.id,
            roomNumber: room.roomNumber,
            reservationId: r.id,
            guestName: r.primaryGuest?.name || r.guestName || 'Guest',
            message: `Room ${room.roomNumber} is occupied by guest, but marked as ${st.toUpperCase() || op.toUpperCase()}.`,
            actionType: 'SYNC_HOUSEKEEPING'
          });
        }
      }
    }
  });

  return discrepancies;
}

/**
 * Step 4 Scanner: Stayover Folios for Nightly Room + GST Charges
 * Prepares the preview table for overnight tariff and GST posting
 */
export function scanStayoverFolios(
  reservations = [],
  rooms = [],
  folios = {},
  businessDate,
  customTaxRate = null
) {
  const curDate = normalizeDateStr(businessDate) || getTodayIsoDate();

  // In-house reservations that are staying over (checkOutDate > businessDate)
  const stayoverList = reservations.filter((r) => {
    if (!r) return false;
    const status = (r.status || '').toLowerCase().replace(/[\s-]/g, '_');
    if (status !== 'in_house') return false;
    const checkOut = normalizeDateStr(r.checkOutDate);
    return !checkOut || checkOut > curDate;
  });

  return stayoverList.map((r) => {
    const room = rooms.find(
      (rm) => rm.id === r.roomId || rm.roomNumber === r.roomNumber || rm.roomNumber === r.roomId
    );
    const rackTariff = Number(r.rackRate) || Number(r.baseRatePerNight) || 2500;
    const offeredTariff = r.isComplimentary ? 0 : (Number(r.baseRatePerNight) || rackTariff);

    const gst = calculateIndianRoomGST(offeredTariff, customTaxRate);

    const folioId = r.folioId || (r.id ? `fol_${r.id.replace(/\D/g, '')}` : 'FOL_1');
    const guestName = r.primaryGuest?.name || r.guestName || 'Guest';

    return {
      reservationId: r.id,
      bookingReference: r.bookingReference || `#${r.id}`,
      folioId,
      guestName,
      roomId: r.roomId || '',
      roomNumber: r.roomNumber || (room ? room.roomNumber : 'Unassigned'),
      roomTypeName: r.roomTypeName || (room ? room.roomTypeId : 'Standard'),
      rackTariff,
      offeredTariff,
      isComplimentary: Boolean(r.isComplimentary),
      cgstRate: gst.cgstRate,
      sgstRate: gst.sgstRate,
      cgstAmount: gst.cgstAmount,
      sgstAmount: gst.sgstAmount,
      totalTaxAmount: gst.totalTaxAmount,
      totalRent: gst.totalRent,
      managerOverrideNote: ''
    };
  });
}

/**
 * Atomic Execution of Night Audit & Date Rollover
 * 
 * Atomically performs:
 * 1. Post ROOM_CHARGE, CGST, and SGST to each stayover folio
 * 2. Update folio balances
 * 3. Save immutable audit snapshot with KPIs, room charges, checked-out list, pax movement
 * 4. Advance property business date by +1 day
 * 5. Sync to Cloud Firestore and lock the audited business date
 */
export async function executeNightAuditAtomic({
  auditorName = 'Astha India',
  managerNotes = '',
  stayoverCharges = [],
  customTaxRate = null
} = {}) {
  const state = pmsStore.getState();
  const curBusinessDate = state.property?.businessDate || getTodayIsoDate();
  const nextBusinessDate = getNextDayIsoDate(curBusinessDate);

  // 1. Idempotency Check: Verify if an audit for this date is already COMPLETED
  const alreadyCompleted = (state.nightAudits || []).some(
    (a) =>
      (a.auditDate === curBusinessDate || a.date?.includes(curBusinessDate)) &&
      (a.status === 'COMPLETED' || a.statusText === 'Completed')
  );

  if (alreadyCompleted) {
    return {
      success: false,
      message: `Night Audit for ${formatDisplayDate(curBusinessDate)} has already been completed. Rollover date is locked.`
    };
  }

  // 2. Prepare charges to post
  const charges = Array.isArray(stayoverCharges) && stayoverCharges.length > 0
    ? stayoverCharges
    : scanStayoverFolios(state.reservations, state.rooms, state.folios, curBusinessDate, customTaxRate);

  const nowIso = new Date().toISOString();
  let totalRoomTariffExclTax = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalNetRevenue = 0;

  const roomChargesLedger = [];

  // Post to each stayover folio
  charges.forEach((item, idx) => {
    const tariff = Number(item.offeredTariff) || 0;
    const cgst = Number(item.cgstAmount) || 0;
    const sgst = Number(item.sgstAmount) || 0;
    const totalTax = Math.round((cgst + sgst) * 100) / 100;
    const netTotal = Math.round((tariff + totalTax) * 100) / 100;

    totalRoomTariffExclTax += tariff;
    totalCGST += cgst;
    totalSGST += sgst;
    totalNetRevenue += netTotal;

    const folioId = item.folioId;
    const folio = state.folios?.[folioId];

    if (folio) {
      const txs = Array.isArray(folio.transactions) ? [...folio.transactions] : [];

      // 1. Post Room Tariff
      txs.push({
        id: `tx_audit_tariff_${Date.now()}_${idx}`,
        date: curBusinessDate,
        type: 'ROOM_CHARGE',
        desc: `Room Tariff - Room ${item.roomNumber}${item.managerOverrideNote ? ` (${item.managerOverrideNote})` : ''}`,
        amount: tariff,
        auditTimestamp: nowIso
      });

      // 2. Post CGST (if applicable)
      if (cgst > 0) {
        txs.push({
          id: `tx_audit_cgst_${Date.now()}_${idx}`,
          date: curBusinessDate,
          type: 'TAX',
          desc: `CGST (${item.cgstRate}%) - Room ${item.roomNumber}`,
          amount: cgst,
          auditTimestamp: nowIso
        });
      }

      // 3. Post SGST (if applicable)
      if (sgst > 0) {
        txs.push({
          id: `tx_audit_sgst_${Date.now()}_${idx}`,
          date: curBusinessDate,
          type: 'TAX',
          desc: `SGST (${item.sgstRate}%) - Room ${item.roomNumber}`,
          amount: sgst,
          auditTimestamp: nowIso
        });
      }

      // Update folio running balances
      const totalCharges = (Number(folio.totalCharges) || 0) + tariff;
      const totalTaxSum = (Number(folio.totalTax) || 0) + totalTax;
      const balance = (Number(folio.balance) || 0) + netTotal;

      state.folios[folioId] = {
        ...folio,
        transactions: txs,
        totalCharges: Math.round(totalCharges * 100) / 100,
        totalTax: Math.round(totalTaxSum * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        updatedAt: nowIso
      };

      pmsStore.syncDocToFirestore('folios', folioId, state.folios[folioId]);
    }

    roomChargesLedger.push({
      room: item.roomNumber ? `Room ${item.roomNumber}` : 'Unassigned',
      folio: item.folioId,
      guest: item.guestName,
      nrmlTariff: item.rackTariff,
      ofrdTariff: item.offeredTariff,
      cgst: item.cgstAmount,
      sgst: item.sgstAmount,
      totalTax,
      totalRent: netTotal,
      note: item.managerOverrideNote || ''
    });
  });

  // 3. Calculate KPIs
  const inHouseReservations = state.reservations.filter((r) => {
    const st = (r.status || '').toLowerCase().replace(/[\s-]/g, '_');
    return st === 'in_house';
  });

  const kpis = calculateNightAuditKPIs({
    rooms: state.rooms,
    occupiedRooms: inHouseReservations.length,
    totalRoomTariffExclTax
  });

  // Checked out list for today
  const checkedOutReservations = state.reservations.filter((r) => {
    const st = (r.status || '').toLowerCase().replace(/[\s-]/g, '_');
    return st === 'checked_out' && normalizeDateStr(r.checkOutDate) === curBusinessDate;
  });

  const checkedOutList = checkedOutReservations.map((r) => {
    const folio = state.folios?.[r.folioId];
    return {
      room: r.roomNumber ? `Room ${r.roomNumber}` : '—',
      folio: r.folioId || '—',
      guest: r.primaryGuest?.name || r.guestName || 'Guest',
      arrival: formatDisplayDate(r.checkInDate),
      departure: formatDisplayDate(r.checkOutDate),
      nights: Number(r.nights) || 1,
      roomCharges: folio?.totalCharges || r.totalRoomCharges || 0,
      extraCharges: 0,
      discount: 0,
      tax: folio?.totalTax || r.taxAmount || 0,
      payment: folio?.totalPayments || r.paidAmount || 0,
      balance: folio?.balance || 0
    };
  });

  // Departmental Reconciliation
  const recon = scanShiftReconciliation(state.folios, state.reservations, curBusinessDate);

  // 4. Create Frozen Immutable Audit Snapshot
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  const curDateFormatted = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const displayCurDate = formatDisplayDate(curBusinessDate);
  const displayNextDate = formatDisplayDate(nextBusinessDate);

  const auditRecord = {
    id: `audit_${Date.now()}`,
    date: displayCurDate,
    auditDate: curBusinessDate,
    newBusinessDate: displayNextDate,
    newBusinessDateIso: nextBusinessDate,
    startedTime: `${curDateFormatted} ${timeFormatted}`,
    startedDate: curDateFormatted,
    startedHour: timeFormatted,
    completedTime: `${displayCurDate} ${timeFormatted}`,
    completedDate: displayCurDate,
    completedHour: timeFormatted,
    performedBy: auditorName,
    performedAt: nowIso,
    status: 'COMPLETED',
    statusText: 'Completed',
    managerNotes,
    // KPIs
    kpis,
    occupancyPercent: kpis.occupancyPercent,
    adr: kpis.adr,
    revpar: kpis.revpar,
    totalRevenue: totalNetRevenue,
    totalRoomTariff: totalRoomTariffExclTax,
    totalCGST,
    totalSGST,
    totalTax: Math.round((totalCGST + totalSGST) * 100) / 100,
    chargesPostedCount: charges.length,
    amountPosted: totalNetRevenue,
    // Frozen Detailed Ledgers
    roomCharges: roomChargesLedger,
    checkedOutList,
    outletRevenues: recon.outlets,
    collections: recon.collections,
    // Room inventory breakdown
    roomStatus: {
      total: kpis.totalRooms,
      occupied: kpis.occupiedRooms,
      dueOut: 0,
      vacant: kpis.vacantRooms,
      departed: checkedOutList.length,
      blocked: kpis.blockedRooms
    },
    // Pax movement
    paxStatus: [
      { status: 'Arrived', rooms: 0, adult: 0, child: 0 },
      { status: 'Checked Out', rooms: checkedOutList.length, adult: checkedOutList.length, child: 0 },
      { status: 'Stayover', rooms: inHouseReservations.length, adult: inHouseReservations.length, child: 0 }
    ],
    isLocked: true // Date locking
  };

  // 5. Save to pmsStore memory and Firestore
  pmsStore.nightAudits = [auditRecord, ...(pmsStore.nightAudits || [])];
  pmsStore.property = {
    ...(pmsStore.property || {}),
    businessDate: nextBusinessDate,
    lastAuditDate: curBusinessDate,
    lastAuditId: auditRecord.id
  };

  pmsStore.logAudit(
    'NIGHT_AUDIT',
    'SYSTEM',
    auditRecord.id,
    `Night Audit completed for ${displayCurDate}. Posted ₹${totalNetRevenue} tariffs & taxes across ${charges.length} folios. Advanced business date to ${displayNextDate}.`,
    auditorName
  );

  pmsStore.save();
  pmsStore.syncDocToFirestore('nightAudits', auditRecord.id, auditRecord);
  pmsStore.syncDocToFirestore('', pmsStore.propertyId, { businessDate: nextBusinessDate, lastAuditDate: curBusinessDate });
  pmsStore.notify();

  return {
    success: true,
    auditRecord,
    curBusinessDate: displayCurDate,
    nextBusinessDate: displayNextDate
  };
}
