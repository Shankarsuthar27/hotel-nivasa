// Comprehensive Date & Room Matching Utilities for Hotel PMS Pro
// Handles all timezone-safe date operations and multi-format room matching

/**
 * Normalizes any date representation (YYYY-MM-DD, DD/MM/YYYY, 'Fri 13, Nov 2026', Date object, ISO timestamp)
 * to standard 'YYYY-MM-DD' local date string without timezone shifts.
 */
export function normalizeDateStr(d) {
  if (!d) return '';
  if (d instanceof Date) {
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const str = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return str.slice(0, 10);
}

/**
 * Returns today's date in local YYYY-MM-DD format
 */
export function getTodayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Computes next day in local YYYY-MM-DD format from a given date
 */
export function getNextDayIsoDate(dateStr) {
  if (!dateStr) return getTodayIsoDate();
  const normalized = normalizeDateStr(dateStr);
  const parts = normalized.split('-');
  if (parts.length === 3) {
    const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    dt.setDate(dt.getDate() + 1);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const dt = new Date(dateStr);
  dt.setDate(dt.getDate() + 1);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Checks if two stay date intervals [in1, out1) and [in2, out2) overlap
 */
export function doDateRangesOverlap(in1, out1, in2, out2) {
  const start1 = normalizeDateStr(in1);
  let end1 = normalizeDateStr(out1);
  const start2 = normalizeDateStr(in2);
  let end2 = normalizeDateStr(out2);

  if (!start1 || !start2) return false;
  if (!end1 || end1 <= start1) end1 = getNextDayIsoDate(start1);
  if (!end2 || end2 <= start2) end2 = getNextDayIsoDate(start2);

  return start1 < end2 && end1 > start2;
}

/**
 * Robust checker to see if a reservation, block, or row reference matches a room object
 */
export function isResMatchingRoom(res, room) {
  if (!res || !room) return false;
  const targetId = String(room.id || '').trim().toLowerCase();
  const targetNum = String(room.roomNumber || '').trim().toLowerCase();
  const targetBareId = targetId.replace(/^rm_/, '');
  const targetBareNum = targetNum.replace(/^rm_/, '');

  const checkVal = (val) => {
    if (!val && val !== 0) return false;
    const str = String(val).trim().toLowerCase();
    const bareStr = str.replace(/^rm_/, '');
    return (
      str === targetId ||
      str === targetNum ||
      bareStr === targetBareId ||
      bareStr === targetBareNum ||
      (targetNum && (str === targetNum || bareStr === targetNum || str === `rm_${targetNum}`)) ||
      (targetBareNum && (bareStr === targetBareNum || str === targetBareNum))
    );
  };

  if (checkVal(res.roomId)) return true;
  if (checkVal(res.roomNumber)) return true;
  if (checkVal(res.room)) return true;
  if (typeof res.room === 'object') {
    if (checkVal(res.room?.id) || checkVal(res.room?.roomNumber)) return true;
  }
  if (checkVal(res.allocatedRoomId)) return true;
  if (checkVal(res.assignedRoomId)) return true;

  if (Array.isArray(res.configuredRooms)) {
    if (res.configuredRooms.some((cr) => checkVal(cr?.roomId) || checkVal(cr?.roomNumber))) {
      return true;
    }
  }
  if (Array.isArray(res.rooms)) {
    if (res.rooms.some((r) => (typeof r === 'object' ? (checkVal(r?.id) || checkVal(r?.roomNumber)) : checkVal(r)))) {
      return true;
    }
  }

  return false;
}

