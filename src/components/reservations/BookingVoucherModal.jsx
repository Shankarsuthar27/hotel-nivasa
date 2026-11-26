import React from 'react';
import { X, Printer, Send, Building } from 'lucide-react';
import { getAccurateArrivalTime } from '../../services/dateUtils';

function formatInr(amount) {
  return (Number(amount) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatBookingSource(source) {
  if (!source) return 'Direct';
  const map = {
    walk_in: 'Walk-In',
    'walk-in': 'Walk-In',
    website: 'Website',
    ota: 'OTA',
    travel_agent: 'Travel Agent',
    'travel agent': 'Travel Agent',
    corporate: 'Corporate',
    phone: 'Phone',
    direct: 'Direct'
  };
  const key = String(source).trim().toLowerCase();
  if (map[key]) return map[key];
  return String(source)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStatus(status) {
  if (!status) return 'Confirmed';
  return String(status)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BookingVoucherModal({ isOpen, onClose, reservation, property }) {
  if (!isOpen || !reservation) return null;

  const propertyName = property?.name || property?.legalName || property?.tradeName || 'Hotel';
  const propertyGstin = property?.gstin?.trim().toUpperCase();
  const propertyAddress = [
    property?.addressLine,
    property?.city,
    property?.state
  ].filter(Boolean).join(', ');
  const fullPropertyAddress = [propertyAddress, property?.postalCode].filter(Boolean).join(' - ');

  const guestName = reservation.primaryGuest?.name || reservation.guestName || 'Guest';
  const guestCompany = reservation.company || reservation.primaryGuest?.company || '';
  const guestPhone = reservation.primaryGuest?.phone || reservation.guestPhone || 'N/A';
  const guestEmail = reservation.primaryGuest?.email || reservation.guestEmail || '';
  const guestGstin = (reservation.guestGstin || reservation.primaryGuest?.gstin || '').trim().toUpperCase();

  const nights = Number(reservation.nights) || 1;
  const adults = Number(reservation.adults) || 1;
  const children = Number(reservation.children) || 0;
  const totalAmount = Number(reservation.totalAmount) || 0;
  const paidAmount = Number(reservation.paidAmount) || 0;
  const balanceDue = Math.max(0, Number(reservation.balanceDue ?? (totalAmount - paidAmount)) || 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay printable-modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '760px' }}>
        {/* Actions Bar (hidden on print) */}
        <div className="modal-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building size={18} color="#2563eb" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
              Booking Voucher — {reservation.bookingReference || reservation.id}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="btn-secondary" onClick={handlePrint}>
              <Printer size={15} />
              <span>Print Voucher</span>
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                alert(`Voucher dispatched to ${guestEmail || guestPhone} via WhatsApp & Email!`);
              }}
            >
              <Send size={15} />
              <span>Send to Guest</span>
            </button>
            <button className="btn-secondary" onClick={onClose} style={{ padding: '0.35rem 0.55rem' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Voucher Body */}
        <div className="modal-body printable-document" style={{ padding: '2rem' }}>
          {/* Hotel Letterhead */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '1.25rem', marginBottom: '1.5rem', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{propertyName}</h2>
              {fullPropertyAddress && (
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0' }}>{fullPropertyAddress}</p>
              )}
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.15rem 0 0' }}>
                Tel: {property?.phone || 'N/A'} • Email: {property?.email || 'N/A'}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#0f172a', fontWeight: 600, margin: '0.2rem 0 0' }}>
                GSTIN: <span style={{ fontFamily: 'var(--font-mono)', color: propertyGstin ? '#0f172a' : '#64748b' }}>{propertyGstin || 'Unregistered'}</span>
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                background: '#eff6ff',
                color: '#2563eb',
                padding: '0.35rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontWeight: 800,
                fontSize: '0.9rem',
                display: 'inline-block',
                marginBottom: '0.45rem'
              }}>
                GUEST BOOKING VOUCHER
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-mono)' }}>
                {reservation.bookingReference || reservation.id}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                Booked via {formatBookingSource(reservation.bookingSource)} • {formatStatus(reservation.status)}
              </div>
            </div>
          </div>

          {/* Guest & Stay Matrix */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '0.25rem' }}>
                GUEST INFORMATION
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                {guestName}
              </div>
              {guestCompany && (
                <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600 }}>
                  {guestCompany}
                </div>
              )}
              <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.15rem' }}>
                Phone: {guestPhone}
              </div>
              {guestEmail && (
                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  Email: {guestEmail}
                </div>
              )}
              {guestGstin && (
                <div style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                  Guest GSTIN: {guestGstin}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '0.25rem' }}>
                RESERVATION ALLOCATION
              </div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>
                {reservation.roomNumber ? `Room ${reservation.roomNumber}` : 'Unassigned'}
                {reservation.roomTypeName ? ` (${reservation.roomTypeName})` : ''}
                {reservation.ratePlanCode ? ` • Plan: ${reservation.ratePlanCode}` : ''}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '0.15rem' }}>
                Occupancy: {adults} {adults === 1 ? 'Adult' : 'Adults'}
                {children > 0 ? `, ${children} ${children === 1 ? 'Child' : 'Children'}` : ''}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                Dates: <strong>{reservation.checkInDate}</strong> to <strong>{reservation.checkOutDate}</strong> ({nights} {nights === 1 ? 'Night' : 'Nights'})
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Check-in: {getAccurateArrivalTime(reservation)} • Check-out: {reservation.checkOutTime || '11:00'}
              </div>
            </div>
          </div>

          {reservation.specialRequests && (
            <div style={{ marginBottom: '1.25rem', padding: '0.7rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: '#92400e' }}>
              <strong>Special Requests:</strong> {reservation.specialRequests}
            </div>
          )}

          {/* Financial Breakdown Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Description</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center' }}>Nights</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Tariff/Night</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Tax (GST)</th>
                <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.75rem' }}>
                  <strong>Room Accommodation (SAC: 996311)</strong>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    {reservation.roomNumber ? `Room ${reservation.roomNumber}` : 'Room Unassigned'}
                    {reservation.ratePlanCode ? ` (${reservation.ratePlanCode})` : ''}
                  </div>
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>{nights}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>₹{formatInr(reservation.baseRatePerNight)}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right' }}>₹{formatInr(reservation.taxAmount)}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>₹{formatInr(totalAmount)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>Total Booking Cost:</td>
                <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>₹{formatInr(totalAmount)}</td>
              </tr>
              <tr>
                <td colSpan={4} style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: '#059669', fontWeight: 600 }}>Amount Paid / Advance:</td>
                <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', color: '#059669', fontWeight: 700 }}>
                  {paidAmount > 0 ? `-₹${formatInr(paidAmount)}` : '₹0.00'}
                </td>
              </tr>
              <tr style={{ fontSize: '0.96rem', borderTop: '2px solid #0f172a' }}>
                <td colSpan={4} style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800 }}>Balance Payable at Check-In:</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, color: balanceDue > 0 ? '#dc2626' : '#059669' }}>
                  {balanceDue > 0 ? `₹${formatInr(balanceDue)}` : '₹0.00 (Paid)'}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Hotel Policies & Verification */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', fontSize: '0.74rem', color: '#64748b', lineHeight: 1.6 }}>
            <p><strong>Hotel Policies & Terms:</strong></p>
            <ul style={{ paddingLeft: '1.25rem' }}>
              <li>Government-issued photo identification (Aadhaar, Passport, or Driving License) is mandatory for all adults upon check-in.</li>
              <li>Standard Check-In time is {property?.checkInTime || '14:00'} hrs and Check-Out time is {property?.checkOutTime || '11:00'} hrs. Early check-in or late check-out is subject to room availability.</li>
              <li>Smoking is strictly prohibited in all indoor guest rooms and public spaces.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
