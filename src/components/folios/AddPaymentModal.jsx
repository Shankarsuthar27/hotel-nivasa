import React, { useState, useEffect } from 'react';
import './add-payment-modal.css';
import {
  X,
  Check,
  ChevronDown,
  CreditCard,
  Banknote,
  QrCode,
  Landmark,
  BookOpen,
  FileSpreadsheet
} from 'lucide-react';
import CustomDatePicker from '../common/CustomDatePicker';
import { getTodayIsoDate } from '../../services/dateUtils';

export default function AddPaymentModal({
  isOpen,
  onClose,
  reservation = {},
  folio = {},
  onConfirmPayment
}) {
  const guestTitle = reservation?.primaryGuest?.title || '';
  const firstName = reservation?.primaryGuest?.firstName || '';
  const lastName = reservation?.primaryGuest?.lastName || '';
  const rawGuestName = reservation?.primaryGuest?.name || `${guestTitle} ${firstName} ${lastName}`.trim() || reservation?.guestName || 'Mr Shankar Suthar';

  // Format capitalized guest name (e.g. "Mr Shankar Suthar")
  const guestFullName = rawGuestName.replace(/\b\w/g, (c) => c.toUpperCase());

  // Folio Number
  const folioNumber = folio?.folioNumber || reservation?.folioId || 'FOL_1';

  // Outstanding Balance
  const outstanding = folio?.balanceDue !== undefined
    ? folio.balanceDue
    : (reservation?.balanceDue !== undefined ? reservation.balanceDue : 0);

  // Form State
  const [selectedFolio, setSelectedFolio] = useState(folioNumber);
  const [paymentDate, setPaymentDate] = useState(getTodayIsoDate());
  const [paymentType, setPaymentType] = useState('Select');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [hasTypedAmount, setHasTypedAmount] = useState(false);
  const [description, setDescription] = useState('');

  // Reset form when modal opens (do not auto-fill amount or payment method)
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setHasTypedAmount(false);
      setPaymentDate(getTodayIsoDate());
      setPaymentType('Select');
      setPaymentMethod('');
      setReceiptNumber('');
      setDescription('');
      setSelectedFolio(folio?.folioNumber || reservation?.folioId || 'FOL_1');
    }
  }, [isOpen, folio?.folioNumber, reservation?.folioId]);

  if (!isOpen) return null;

  const paymentMethods = [
    {
      id: 'CARD',
      label: 'CARD',
      icon: CreditCard
    },
    {
      id: 'CASH',
      label: 'CASH',
      icon: Banknote
    },
    {
      id: 'UPI',
      label: 'UPI',
      icon: QrCode
    },
    {
      id: 'BANK',
      label: 'BANK',
      icon: Landmark
    },
    {
      id: 'CITY LEDGER',
      label: 'CITY LEDGER',
      icon: BookOpen
    },
    {
      id: 'TDS',
      label: 'TDS',
      icon: FileSpreadsheet
    }
  ];

  const isTypeSelected = Boolean(paymentType && paymentType !== 'Select');
  const isMethodSelected = Boolean(paymentMethod);
  const numAmount = parseFloat(amount);
  const isAmountValid = Boolean(hasTypedAmount && !isNaN(numAmount) && numAmount > 0);
  const isAccessible = Boolean(isTypeSelected && isMethodSelected && isAmountValid);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAccessible) {
      if (!isTypeSelected) {
        alert('Please select a payment Type');
      } else if (!isMethodSelected) {
        alert('Please select a Payment Method');
      } else if (!isAmountValid) {
        alert('Please type a valid payment amount greater than 0.00');
      }
      return;
    }

    if (onConfirmPayment) {
      onConfirmPayment({
        folioId: selectedFolio,
        date: paymentDate || getTodayIsoDate(),
        type: paymentType,
        paymentMethod,
        receiptNumber: receiptNumber.trim(),
        reference: receiptNumber.trim() || '-',
        amount: numAmount,
        description: description.trim() || `${paymentMethod} Payment`
      });
    }

    onClose();
  };

  return (
    <div className="add-payment-backdrop" onClick={onClose}>
      <div className="add-payment-dialog" onClick={(e) => e.stopPropagation()}>
        {/* 1. Header */}
        <div className="add-payment-header">
          <div className="add-payment-header-left">
            <div className="add-payment-icon-bubble">
              {/* Contactless payment icon matching screenshot */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M11 9a4 4 0 0 1 0 6" />
                <path d="M14 7a7 7 0 0 1 0 10" />
              </svg>
            </div>
            <div className="add-payment-title-group">
              <h3 className="add-payment-title">Add Payment</h3>
              <p className="add-payment-subtitle">
                Adding to folio:{' '}
                <span className="add-payment-guest-highlight">{guestFullName}</span>
              </p>
            </div>
          </div>

          <button className="add-payment-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* 2. Form */}
        <form onSubmit={handleSubmit} className="add-payment-form">
          {/* Field 1: Folio */}
          <div className="add-payment-field-group">
            <label className="add-payment-label">
              Folio<span className="add-payment-required">*</span>
            </label>
            <div className="add-payment-select-wrap">
              <select
                className="add-payment-select"
                value={selectedFolio}
                onChange={(e) => setSelectedFolio(e.target.value)}
              >
                <option value={folioNumber}>
                  {folioNumber} - {guestFullName.toLowerCase()}
                </option>
              </select>
              <ChevronDown size={16} className="add-payment-chevron" />
            </div>
          </div>

          {/* Field: Date (Current Date of Making Payment) */}
          <div className="add-payment-field-group">
            <label className="add-payment-label">
              Date<span className="add-payment-required">*</span>
            </label>
            <CustomDatePicker
              value={paymentDate}
              onChange={(val) => setPaymentDate(val)}
              placeholder="Select date"
              displayFormat="dmy"
              outputFormat="iso"
            />
          </div>

          {/* Field 2: Type */}
          <div className="add-payment-field-group">
            <label className="add-payment-label">
              Type<span className="add-payment-required">*</span>
            </label>
            <div className="add-payment-select-wrap">
              <select
                className="add-payment-select"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
              >
                <option value="Select">Select</option>
                <option value="Settlement">Settlement</option>
                <option value="Advance">Advance</option>
                <option value="Discount">Discount</option>
              </select>
              <ChevronDown size={16} className="add-payment-chevron" />
            </div>
          </div>

          {/* Field 3: Payment Method */}
          <div className="add-payment-field-group">
            <label className="add-payment-label">
              Payment Method<span className="add-payment-required">*</span>
            </label>
            <div className="add-payment-methods-grid">
              {paymentMethods.map((method) => {
                const IconComponent = method.icon;
                const isSelected = paymentMethod === method.id;
                return (
                  <div
                    key={method.id}
                    className={`add-payment-method-tile ${isSelected ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod(method.id)}
                  >
                    {isSelected && (
                      <div className="add-payment-check-badge">
                        <Check size={10} color="#ffffff" strokeWidth={3.5} />
                      </div>
                    )}
                    <div className="add-payment-method-icon">
                      <IconComponent size={20} strokeWidth={isSelected ? 2 : 1.75} />
                    </div>
                    <span className="add-payment-method-label">{method.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Field 4: Rec/Vou # */}
          <div className="add-payment-field-group">
            <label className="add-payment-label">Rec/Vou #</label>
            <input
              type="text"
              className="add-payment-input"
              placeholder="Enter receipt/voucher number"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
            />
          </div>

          {/* Field 5: Amount */}
          <div className="add-payment-field-group">
            <label className="add-payment-label">
              Amount<span className="add-payment-required">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="add-payment-input"
              placeholder={outstanding > 0 ? `0.00 (Due: ₹${Number(outstanding).toFixed(2)})` : "0.00"}
              required
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setHasTypedAmount(true);
              }}
            />
          </div>

          {/* Field 6: Description */}
          <div className="add-payment-field-group">
            <label className="add-payment-label">Description</label>
            <textarea
              rows={2}
              className="add-payment-textarea"
              placeholder="Add remarks about this payment... (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* 3. Footer Actions */}
          <div className="add-payment-footer">
            <button
              type="button"
              className="add-payment-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isAccessible}
              className={`add-payment-btn-submit ${isAccessible ? 'active' : ''}`}
              title={!isAccessible ? 'Please select Type, Payment Method, and manually type Amount to enable' : 'Post Payment'}
            >
              <Check size={16} strokeWidth={2.5} />
              <span>Post Payment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
