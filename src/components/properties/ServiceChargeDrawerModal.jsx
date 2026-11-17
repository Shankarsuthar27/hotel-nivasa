import React, { useState, useEffect } from 'react';
import { Tag, X, Plus } from 'lucide-react';

export default function ServiceChargeDrawerModal({
  isOpen,
  onClose,
  onSaveCharge,
  chargeToEdit = null,
  taxRules = [],
  showToast
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Food & Beverage');
  const [sacCode, setSacCode] = useState('');
  const [price, setPrice] = useState('');
  const [taxRuleId, setTaxRuleId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (chargeToEdit) {
        setName(chargeToEdit.name || '');
        setCategory(chargeToEdit.category || 'Food & Beverage');
        setSacCode(chargeToEdit.sacCode || '');
        setPrice(chargeToEdit.price !== undefined ? chargeToEdit.price : '');
        setTaxRuleId(chargeToEdit.taxRuleId || '');
        setIsActive(chargeToEdit.status !== 'inactive');
        setError('');
      } else {
        setName('');
        setCategory('Food & Beverage');
        setSacCode('996331');
        setPrice('');
        setTaxRuleId(taxRules[0]?.id || '');
        setIsActive(true);
        setError('');
      }
    }
  }, [isOpen, chargeToEdit, taxRules]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Service Charge Name is required.');
      return;
    }

    const chargeData = {
      name: name.trim(),
      category,
      sacCode: sacCode.trim(),
      price: Number(price) || 0,
      taxRuleId,
      status: isActive ? 'active' : 'inactive'
    };

    onSaveCharge(chargeData, chargeToEdit ? chargeToEdit.id : null);
    onClose();
  };

  return (
    <div
      className="meal-plan-drawer-overlay"
      onClick={onClose}
      style={{
        zIndex: 1050,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(1px)'
      }}
    >
      <div
        className="meal-plan-drawer-container"
        style={{
          maxWidth: '560px',
          width: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="meal-plan-drawer-header" style={{ height: '64px', borderBottom: '1px solid #E2E8F0', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: '#EFF6FF',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563EB'
              }}
            >
              <Tag size={18} />
            </div>
            <h3
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                fontWeight: 700,
                color: '#0F172A',
                margin: 0
              }}
            >
              {chargeToEdit ? 'Edit Service Charge' : 'Create Service Charge'}
            </h3>
          </div>
          <button
            type="button"
            className="meal-plan-drawer-close-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}
          >
            {error && (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FEE2E2',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  color: '#DC2626',
                  fontSize: '13px',
                  fontWeight: 500
                }}
              >
                {error}
              </div>
            )}

            {/* Service Name */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#0F172A',
                  marginBottom: '6px'
                }}
              >
                Service Charge Name <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Breakfast Buffet, Airport Transfer"
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '0 12px',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Category & SAC Code */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    marginBottom: '6px'
                  }}
                >
                  Service Category <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Food & Beverage">Food & Beverage</option>
                  <option value="Transportation">Transportation</option>
                  <option value="Laundry">Laundry</option>
                  <option value="Spa & Wellness">Spa & Wellness</option>
                  <option value="Banquet & Events">Banquet & Events</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    marginBottom: '6px'
                  }}
                >
                  SAC / HSN Code
                </label>
                <input
                  type="text"
                  value={sacCode}
                  onChange={(e) => setSacCode(e.target.value)}
                  placeholder="e.g. 996331"
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Default Price & Applicable Tax Rule */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    marginBottom: '6px'
                  }}
                >
                  Default Price (₹)
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#0F172A',
                    marginBottom: '6px'
                  }}
                >
                  Applicable Tax Rule
                </label>
                <select
                  value={taxRuleId}
                  onChange={(e) => setTaxRuleId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">None / Tax Exempt</option>
                  {taxRules.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.name} ({tr.categoryType})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status Active */}
            <div
              style={{
                borderTop: '1px solid #F1F5F9',
                paddingTop: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>
                  Status Active
                </span>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                  Active services appear in guest folio extra charge selectors
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsActive(!isActive)}
                style={{
                  width: '42px',
                  height: '24px',
                  borderRadius: '12px',
                  backgroundColor: isActive ? '#2563EB' : '#CBD5E1',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                  padding: '2px'
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    position: 'absolute',
                    top: '2px',
                    left: isActive ? '20px' : '2px',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }}
                />
              </button>
            </div>
          </div>

          {/* Sticky Drawer Footer */}
          <div
            style={{
              height: '68px',
              borderTop: '1px solid #E2E8F0',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: '#ffffff'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '9px 24px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563EB',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)'
              }}
            >
              {chargeToEdit ? 'Update Service Charge' : 'Create Service Charge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

