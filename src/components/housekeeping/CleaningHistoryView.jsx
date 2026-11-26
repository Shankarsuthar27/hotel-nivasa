import React, { useState, useMemo } from 'react';
import {
  Search,
  Calendar,
  Clock,
  User,
  BedDouble,
  CheckCircle2,
  Filter,
  RotateCcw
} from 'lucide-react';
import SweepingBroomIcon from './SweepingBroomIcon';
import { getTodayIsoDate, formatDisplayDate } from '../../services/dateUtils';

export default function CleaningHistoryView({
  cleaningHistory = [],
  rooms = [],
  roomTypes = [],
  auditTrail = []
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  const todayIso = getTodayIsoDate();

  // Combine dedicated cleaningHistory records with any legacy auditTrail cleaning entries
  const allRecords = useMemo(() => {
    const map = new Map();

    (cleaningHistory || []).forEach((rec) => {
      if (!rec) return;
      map.set(rec.id, rec);
    });

    (auditTrail || []).forEach((entry) => {
      if (!entry || entry.action !== 'HOUSEKEEPING_UPDATE') return;
      const details = String(entry.details || '');
      const match = details.match(/^Marked CLEAN by (.+?)(?: at (.+))?$/i);
      if (!match) return;

      const roomNum = String(entry.entityId || '').trim();
      const matchedRoom = rooms.find(
        (r) => String(r.roomNumber) === roomNum || r.id === entry.entityId
      );
      const matchedRt = roomTypes.find((rt) => rt.id === matchedRoom?.roomTypeId);
      const createdMs = entry.createdAtMs || Date.parse(entry.timestamp) || 0;

      // Avoid duplicating if a cleaningHistory record already exists within 5 seconds for same room
      const alreadyExists = Array.from(map.values()).some(
        (r) =>
          String(r.roomNumber) === roomNum &&
          Math.abs((r.createdAtMs || 0) - createdMs) < 5000
      );
      if (alreadyExists) return;

      const dateIso = entry.timestamp ? String(entry.timestamp).slice(0, 10) : todayIso;
      map.set(entry.id || `audit_${createdMs}_${roomNum}`, {
        id: entry.id || `audit_${createdMs}_${roomNum}`,
        roomId: matchedRoom?.id || '',
        roomNumber: roomNum || '—',
        roomTypeId: matchedRoom?.roomTypeId || '',
        roomTypeName: matchedRt?.name || matchedRoom?.roomTypeName || 'Room',
        cleanedBy: match[1].trim(),
        cleanedDate: dateIso,
        cleanedTime: '',
        cleanedTimeFormatted: match[2]?.trim() || '',
        notes: '',
        markedBy: entry.user || 'Front Desk',
        createdAt: entry.timestamp || '',
        createdAtMs: createdMs
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)
    );
  }, [cleaningHistory, auditTrail, rooms, roomTypes, todayIso]);

  // Filtered list
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRecords.filter((rec) => {
      if (roomTypeFilter !== 'ALL') {
        const matchesId = rec.roomTypeId === roomTypeFilter;
        const rtName = roomTypes.find((rt) => rt.id === roomTypeFilter)?.name || '';
        const matchesName =
          rtName && String(rec.roomTypeName || '').toLowerCase() === rtName.toLowerCase();
        if (!matchesId && !matchesName) return false;
      }
      if (dateFilter && rec.cleanedDate !== dateFilter) {
        return false;
      }
      if (q) {
        const hay = `${rec.roomNumber} ${rec.roomTypeName} ${rec.cleanedBy} ${rec.notes} ${rec.markedBy}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRecords, roomTypeFilter, dateFilter, searchQuery, roomTypes]);

  // Summary metrics
  const stats = useMemo(() => {
    const todayRecords = allRecords.filter((r) => r.cleanedDate === todayIso);
    const uniqueCleanersToday = new Set(
      todayRecords.map((r) => String(r.cleanedBy || '').trim().toLowerCase()).filter(Boolean)
    );
    return {
      total: allRecords.length,
      todayCount: todayRecords.length,
      cleanersToday: uniqueCleanersToday.size
    };
  }, [allRecords, todayIso]);

  return (
    <div
      style={{
        padding: '12px 0 0 0',
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#f8fafc',
        minHeight: 'calc(100vh - 54px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      {/* 1. Summary KPI Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px'
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <SweepingBroomIcon size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>
              Total Cleanings Logged
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
              {stats.total}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>
              Cleaned Today
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
              {stats.todayCount}
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: '#f5f3ff',
              color: '#7c3aed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <User size={20} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>
              Cleaners Active Today
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
              {stats.cleanersToday}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0 12px',
              height: '38px',
              minWidth: '240px',
              flex: '1 1 240px',
              maxWidth: '340px'
            }}
          >
            <Search size={15} color="#64748b" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search room no., cleaner name, remarks..."
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                width: '100%',
                fontSize: '13.5px',
                color: '#0f172a'
              }}
            />
          </div>

          {/* Room Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="#64748b" />
            <select
              value={roomTypeFilter}
              onChange={(e) => setRoomTypeFilter(e.target.value)}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 500,
                color: '#0f172a',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Room Types</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff'
            }}
          >
            <Calendar size={14} color="#64748b" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '13.5px',
                color: '#0f172a',
                cursor: 'pointer'
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setDateFilter(dateFilter === todayIso ? '' : todayIso)}
            style={{
              height: '38px',
              padding: '0 14px',
              borderRadius: '8px',
              border: `1px solid ${dateFilter === todayIso ? '#2563eb' : '#e2e8f0'}`,
              backgroundColor: dateFilter === todayIso ? '#eff6ff' : '#ffffff',
              color: dateFilter === todayIso ? '#2563eb' : '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Today
          </button>

          {(searchQuery || roomTypeFilter !== 'ALL' || dateFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setRoomTypeFilter('ALL');
                setDateFilter('');
              }}
              style={{
                height: '38px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#64748b',
                fontSize: '13px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Cleaning History Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          borderBottom: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderRadius: 0,
          overflow: 'hidden',
          flex: 1
        }}
      >
        {filteredRecords.length === 0 ? (
          <div style={{ padding: '64px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                backgroundColor: '#f1f5f9',
                color: '#64748b',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px'
              }}
            >
              <SweepingBroomIcon size={26} />
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
              No Cleaning History Found
            </h3>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b' }}>
              {allRecords.length === 0
                ? 'When a dirty room is marked clean in Room View, the cleaner name and time will appear here.'
                : 'No cleaning records match your current search or date filters.'}
            </p>
          </div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '13px 20px', fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                    Room
                  </th>
                  <th style={{ padding: '13px 16px', fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                    Cleaned By
                  </th>
                  <th style={{ padding: '13px 16px', fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                    Cleaning Date
                  </th>
                  <th style={{ padding: '13px 16px', fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                    Cleaning Time
                  </th>
                  <th style={{ padding: '13px 16px', fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                    Status
                  </th>
                  <th style={{ padding: '13px 16px', fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                    Remarks
                  </th>
                  <th style={{ padding: '13px 20px', fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>
                    Marked By
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => (
                  <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            fontWeight: 700,
                            fontSize: '13px'
                          }}
                        >
                          <BedDouble size={14} />
                          <span>{rec.roomNumber}</span>
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: '#475569' }}>
                          {rec.roomTypeName}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '999px',
                            backgroundColor: '#ecfdf5',
                            color: '#059669',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            flexShrink: 0
                          }}
                        >
                          {String(rec.cleanedBy || 'C').charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                          {rec.cleanedBy}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '13.5px', color: '#334155', fontWeight: 500 }}>
                      {rec.cleanedDate ? formatDisplayDate(rec.cleanedDate) : '—'}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#334155'
                        }}
                      >
                        <Clock size={13} color="#64748b" />
                        <span>{rec.cleanedTimeFormatted || rec.cleanedTime || '—'}</span>
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 10px',
                          borderRadius: '999px',
                          backgroundColor: '#ecfdf5',
                          color: '#059669',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        <CheckCircle2 size={12} />
                        <span>Clean</span>
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#64748b', maxWidth: '240px' }}>
                      {rec.notes || '—'}
                    </td>

                    <td style={{ padding: '14px 20px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                      {rec.markedBy || 'Front Desk'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
