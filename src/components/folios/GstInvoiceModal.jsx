import React from 'react';
import { X, Printer, FileText } from 'lucide-react';
import { generateTaxInvoiceSummary, resolvePlaceOfSupply } from '../../services/taxEngine';

function formatInr(amount) {
  return (Number(amount) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function numberToIndianWords(num) {
  const value = Math.round((Number(num) || 0) * 100) / 100;
  if (value === 0) return 'Rupees Zero Only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const twoDigits = (n) => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`.trim();
  };

  const integerPart = Math.floor(value);
  const paisePart = Math.round((value - integerPart) * 100);

  const convertInt = (n) => {
    if (n === 0) return '';
    const parts = [];
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const hundred = Math.floor((n % 1000) / 100);
    const rest = n % 100;

    if (crore) parts.push(`${convertInt(crore)} Crore`);
    if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
    if (hundred) parts.push(`${ones[hundred]} Hundred`);
    if (rest) parts.push(twoDigits(rest));
    return parts.join(' ').trim();
  };

  const rupeeWords = integerPart > 0 ? `Rupees ${convertInt(integerPart)}` : '';
  const paiseWords = paisePart > 0 ? `${twoDigits(paisePart)} Paise` : '';

  if (rupeeWords && paiseWords) return `${rupeeWords} and ${paiseWords} Only`;
  if (rupeeWords) return `${rupeeWords} Only`;
  return `${paiseWords} Only`;
}

function calculateNights(checkInDate, checkOutDate) {
  if (!checkInDate || !checkOutDate) return null;
  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : null;
}

export default function GstInvoiceModal({ isOpen, onClose, reservation, folio, property }) {
  if (!isOpen || !reservation) return null;

  const recipientGstin = (
    reservation.guestGstin ||
    reservation.primaryGuest?.gstin ||
    ''
  ).trim().toUpperCase();

  const guestWithGstin = {
    ...(reservation.primaryGuest || {}),
    gstin: recipientGstin
  };

  const transactions = Array.isArray(folio?.transactions) ? folio.transactions : [];
  const invoiceSummary = generateTaxInvoiceSummary(
    transactions,
    property,
    guestWithGstin
  );

  const totalPayments = transactions.reduce((sum, tx) => {
    if (!tx || tx.isVoided) return sum;
    if (tx.type === 'PAYMENT' || tx.direction === 'CREDIT' || tx.direction === 'Credit' || Number(tx.amount) < 0) {
      return sum + Math.abs(Number(tx.amount) || 0);
    }
    return sum;
  }, 0);
  const balanceDue = Math.max(0, Math.round((invoiceSummary.totalGross - totalPayments) * 100) / 100);

  const placeOfSupply = resolvePlaceOfSupply(
    recipientGstin,
    reservation.primaryGuest?.state,
    property?.gstin,
    property?.state
  );
  const placeOfSupplyText = placeOfSupply.stateCode
    ? `${placeOfSupply.stateName} (Code: ${placeOfSupply.stateCode})`
    : placeOfSupply.stateName;

  const propertyLegalName = property?.legalName || property?.tradeName || property?.name || 'Hotel';
  const propertyGstin = property?.gstin?.trim().toUpperCase();
  const invoiceNumber = `INV-${folio?.folioNumber || reservation.bookingReference?.replace('#', '') || reservation.id || '001'}`;
  const invoiceDate = property?.businessDate || reservation.checkOutDate || new Date().toISOString().split('T')[0];
  const nights = calculateNights(reservation.checkInDate, reservation.checkOutDate);

  const guestName = reservation.primaryGuest?.name || reservation.guestName || 'Guest';
  const guestCompany = reservation.company || reservation.primaryGuest?.company || '';
  const guestPhone = reservation.primaryGuest?.phone || reservation.guestPhone || 'N/A';
  const guestEmail = reservation.primaryGuest?.email || reservation.guestEmail || 'N/A';
  const guestAddressParts = [
    reservation.primaryGuest?.address,
    reservation.primaryGuest?.city,
    reservation.primaryGuest?.state,
    reservation.primaryGuest?.postalCode
  ].filter(Boolean);

  const propertyCityLine = [
    property?.city,
    property?.state
  ].filter(Boolean).join(', ');
  const propertyCityPostal = [
    propertyCityLine,
    property?.postalCode
  ].filter(Boolean).join(' - ');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay printable-modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '840px' }}>
        {/* Modal Controls (Hidden in Print) */}
        <div className="modal-header no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} color="#2563eb" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
              Tax Invoice Preview — {folio?.folioNumber || invoiceNumber}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button className="btn-primary" onClick={handlePrint}>
              <Printer size={15} />
              <span>Print Tax Invoice</span>
            </button>
            <button className="btn-secondary" onClick={onClose} style={{ padding: '0.35rem 0.55rem' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Tax Invoice Document */}
        <div className="modal-body printable-document" style={{ padding: '2.25rem' }}>
          {/* Document Header */}
          <div style={{ textAlign: 'center', marginBottom: '1.25rem', borderBottom: '2px solid #0f172a', paddingBottom: '0.9rem', position: 'relative' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 900, textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.04em', margin: 0 }}>
              TAX INVOICE
            </h1>
            <p style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, margin: '0.2rem 0 0' }}>
              (Issued under Section 31 of Central Goods and Services Tax Act, 2017)
            </p>
            <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Original for Recipient
            </div>
          </div>

          {/* Supplier & Recipient Meta Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.25rem', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
            {/* Supplier / Hotel Details */}
            <div style={{ border: '1px solid #cbd5e1', padding: '0.95rem 1rem', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#0f172a', marginBottom: '0.2rem' }}>
                {propertyLegalName}
              </div>
              {property?.tradeName && (
                <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                  Trade Name: <strong>{property.tradeName}</strong>
                </div>
              )}
              <div style={{ color: '#334155', lineHeight: 1.5 }}>
                {property?.addressLine && <>{property.addressLine}<br /></>}
                {propertyCityPostal && <>{propertyCityPostal}<br /></>}
                Phone: {property?.phone || 'N/A'} • Email: {property?.email || 'N/A'}
              </div>
              <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0', fontWeight: 700, color: '#0f172a' }}>
                GSTIN:{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: propertyGstin ? '#0f172a' : '#64748b' }}>
                  {propertyGstin || 'Unregistered'}
                </span>
              </div>
            </div>

            {/* Invoice Specifics */}
            <div style={{ border: '1px solid #cbd5e1', padding: '0.95rem 1rem', borderRadius: 'var(--radius-sm)', background: '#f8fafc' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.22rem 0', color: '#64748b' }}>Invoice No:</td>
                    <td style={{ padding: '0.22rem 0', fontWeight: 800, textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#0f172a' }}>
                      {invoiceNumber}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.22rem 0', color: '#64748b' }}>Invoice Date:</td>
                    <td style={{ padding: '0.22rem 0', fontWeight: 700, textAlign: 'right', color: '#0f172a' }}>
                      {invoiceDate}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.22rem 0', color: '#64748b' }}>Booking Reference:</td>
                    <td style={{ padding: '0.22rem 0', fontWeight: 700, textAlign: 'right', color: '#0f172a' }}>
                      {reservation.bookingReference || reservation.id}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.22rem 0', color: '#64748b' }}>Room Number:</td>
                    <td style={{ padding: '0.22rem 0', fontWeight: 700, textAlign: 'right', color: '#0f172a' }}>
                      {reservation.roomNumber ? `Room ${reservation.roomNumber}` : 'Unassigned'}
                      {reservation.roomTypeName ? ` (${reservation.roomTypeName})` : ''}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.22rem 0', color: '#64748b' }}>Stay Period:</td>
                    <td style={{ padding: '0.22rem 0', fontWeight: 600, textAlign: 'right', fontSize: '0.74rem', color: '#0f172a' }}>
                      {reservation.checkInDate} to {reservation.checkOutDate}
                      {nights !== null ? ` (${nights} ${nights === 1 ? 'Night' : 'Nights'})` : ''}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.22rem 0', color: '#64748b' }}>Reverse Charge:</td>
                    <td style={{ padding: '0.22rem 0', fontWeight: 600, textAlign: 'right', color: '#0f172a' }}>
                      No
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Billed To / Guest Details */}
          <div style={{ border: '1px solid #cbd5e1', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.82rem' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, marginBottom: '0.3rem' }}>
              DETAILS OF RECEIVER / BILLED TO:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{guestName}</strong>
                {guestCompany && (
                  <div style={{ color: '#334155', fontSize: '0.78rem', fontWeight: 600 }}>
                    {guestCompany}
                  </div>
                )}
                {guestAddressParts.length > 0 && (
                  <div style={{ color: '#475569', fontSize: '0.76rem' }}>
                    {guestAddressParts.join(', ')}
                  </div>
                )}
                <div style={{ color: '#475569', fontSize: '0.78rem' }}>
                  Phone: {guestPhone} • Email: {guestEmail}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Recipient GSTIN: </span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: recipientGstin ? '#2563eb' : '#64748b' }}>
                    {recipientGstin || 'Unregistered / B2C'}
                  </strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' }}>
                  Place of Supply: <strong>{placeOfSupplyText}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Goods/Services Tax Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.78rem', border: '1px solid #cbd5e1' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #94a3b8', textAlign: 'center' }}>
                <th style={{ padding: '0.5rem', width: '35px', borderRight: '1px solid #cbd5e1' }}>#</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Service Description</th>
                <th style={{ padding: '0.5rem', width: '72px', borderRight: '1px solid #cbd5e1' }}>SAC Code</th>
                <th style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>Taxable Val (₹)</th>
                {invoiceSummary.isInterstate ? (
                  <th style={{ padding: '0.5rem', width: '110px', borderRight: '1px solid #cbd5e1' }}>IGST</th>
                ) : (
                  <>
                    <th style={{ padding: '0.5rem', width: '95px', borderRight: '1px solid #cbd5e1' }}>CGST</th>
                    <th style={{ padding: '0.5rem', width: '95px', borderRight: '1px solid #cbd5e1' }}>SGST</th>
                  </>
                )}
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoiceSummary.lineItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={invoiceSummary.isInterstate ? 6 : 7}
                    style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}
                  >
                    No taxable charges posted on this folio yet.
                  </td>
                </tr>
              ) : (
                invoiceSummary.lineItems.map((item) => (
                  <tr key={item.itemIndex} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #cbd5e1' }}>{item.itemIndex}</td>
                    <td style={{ padding: '0.5rem', borderRight: '1px solid #cbd5e1' }}>
                      <strong>{item.description}</strong>
                      <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Date: {item.date}</div>
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #cbd5e1', fontFamily: 'var(--font-mono)' }}>
                      {item.sacCode}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                      {formatInr(item.taxableValue)}
                    </td>
                    {invoiceSummary.isInterstate ? (
                      <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                        {item.igstRate}%: ₹{formatInr(item.igstAmount)}
                      </td>
                    ) : (
                      <>
                        <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                          {item.cgstRate}%: ₹{formatInr(item.cgstAmount)}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                          {item.sgstRate}%: ₹{formatInr(item.sgstAmount)}
                        </td>
                      </>
                    )}
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>
                      {formatInr(item.totalAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f8fafc', fontWeight: 800, borderTop: '2px solid #0f172a' }}>
                <td colSpan={3} style={{ padding: '0.65rem 0.75rem', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                  TOTAL INVOICE VALUES:
                </td>
                <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                  ₹{formatInr(invoiceSummary.totalTaxable)}
                </td>
                {invoiceSummary.isInterstate ? (
                  <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                    ₹{formatInr(invoiceSummary.totalIgst)}
                  </td>
                ) : (
                  <>
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                      ₹{formatInr(invoiceSummary.totalCgst)}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                      ₹{formatInr(invoiceSummary.totalSgst)}
                    </td>
                  </>
                )}
                <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right', fontSize: '0.92rem', color: '#0f172a' }}>
                  ₹{formatInr(invoiceSummary.totalGross)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Amount in Words & Settlement Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.25rem', marginBottom: '1.5rem', fontSize: '0.78rem' }}>
            <div style={{ border: '1px solid #cbd5e1', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius-sm)', background: '#f8fafc' }}>
              <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>
                Invoice Total (In Words):
              </div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>
                {numberToIndianWords(invoiceSummary.totalGross)}
              </div>
            </div>
            <div style={{ border: '1px solid #cbd5e1', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius-sm)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.15rem 0', color: '#64748b' }}>Total Tax ({invoiceSummary.isInterstate ? 'IGST' : 'CGST + SGST'}):</td>
                    <td style={{ padding: '0.15rem 0', textAlign: 'right', fontWeight: 600 }}>₹{formatInr(invoiceSummary.totalTax)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.15rem 0', color: '#64748b' }}>Payments Received:</td>
                    <td style={{ padding: '0.15rem 0', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>₹{formatInr(totalPayments)}</td>
                  </tr>
                  <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.25rem 0 0', fontWeight: 800, color: '#0f172a' }}>Balance Due:</td>
                    <td style={{ padding: '0.25rem 0 0', textAlign: 'right', fontWeight: 800, color: balanceDue > 0 ? '#dc2626' : '#16a34a' }}>
                      {balanceDue > 0 ? `₹${formatInr(balanceDue)}` : '₹0.00 (Paid)'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Signatures & Certification */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', marginTop: '2rem', fontSize: '0.76rem', color: '#475569' }}>
            <div>
              <p><strong>Declaration:</strong></p>
              <p style={{ marginTop: '0.2rem' }}>
                We declare that this invoice shows the actual price of the hospitality services described and that all particulars are true and correct. Goods/services once consumed are non-refundable.
              </p>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '2.5rem' }}>
                For {propertyLegalName}
              </div>
              <div style={{ borderTop: '1px solid #0f172a', paddingTop: '0.35rem', fontWeight: 700 }}>
                Authorized Signatory / Front Desk Cashier
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
