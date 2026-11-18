// Dynamic Hospitality Tax Engine for Hotel PMS
// Reads live Tax Rules & Definitions (Slabs, Inclusion Mode, Calculation Mode, Splits & Active Status)

export const SAC_CODES = {
  ACCOMMODATION: '996311',
  RESTAURANT_FNB: '996331',
  LAUNDRY: '999799',
  CONFERENCE_BANQUET: '996332'
};

export const DEFAULT_TAX_RULES = [
  {
    id: 'tax_rule_india_gst',
    name: 'India Hotel Slab GST',
    presentationLabel: 'GST',
    categoryType: 'GST',
    calculationMode: 'percentage',
    priceInclusion: 'EXCLUSIVE',
    useSlabs: true,
    rate: 5,
    slabs: [
      { min: 1, max: 7500, rate: 5 },
      { min: 7501, max: null, rate: 18 }
    ],
    splits: [
      { name: 'CGST', share: 0.5 },
      { name: 'SGST', share: 0.5 }
    ],
    status: 'active'
  }
];

let activeTaxRulesRegistry = null;

function round2(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Synchronizes the live Tax Rules & Definitions list from pmsStore
 */
export function setActiveTaxRules(rules) {
  activeTaxRulesRegistry = Array.isArray(rules) ? rules : [];
}

/**
 * Returns the current Tax Rules array (preferring explicit override, then live store registry, then localStorage, then defaults)
 */
export function getConfiguredTaxRules(overrideRules) {
  if (Array.isArray(overrideRules)) return overrideRules;
  if (Array.isArray(activeTaxRulesRegistry)) return activeTaxRulesRegistry;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('hotel_astha_pms_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.taxRules)) {
          return parsed.taxRules;
        }
      }
    }
  } catch (_) {}
  return DEFAULT_TAX_RULES;
}

/**
 * Returns whether the primary active tax rule defaults to INCLUSIVE pricing
 */
export function isDefaultTaxInclusive(overrideRules) {
  const rules = getConfiguredTaxRules(overrideRules).filter(
    (r) => r && r.status !== 'inactive'
  );
  if (rules.length === 0) return false;
  return String(rules[0].priceInclusion || 'EXCLUSIVE').toUpperCase() === 'INCLUSIVE';
}

/**
 * Resolves the applicable tax rate (or fixed amount) for a single unit price under a given Tax Rule
 */
export function resolveRuleRate(unitAmount, rule) {
  const amt = Number(unitAmount) || 0;
  if (!rule || rule.status === 'inactive' || amt <= 0) return 0;

  if (rule.useSlabs && Array.isArray(rule.slabs) && rule.slabs.length > 0) {
    const sorted = [...rule.slabs].sort(
      (a, b) => (Number(a.min) || 0) - (Number(b.min) || 0)
    );

    // 1. Direct bracket match
    for (const slab of sorted) {
      const minVal = Number(slab.min) || 0;
      const hasMax =
        slab.max !== null && slab.max !== '' && slab.max !== undefined && !isNaN(Number(slab.max));
      const maxVal = hasMax ? Number(slab.max) : Infinity;

      if (amt >= minVal && amt <= maxVal) {
        return Number(slab.rate) || 0;
      }
    }

    // 2. Fractional boundary gap fallback (e.g. ₹7500.50 between max 7500 and min 7501)
    for (let i = 0; i < sorted.length; i++) {
      const slab = sorted[i];
      const hasMax =
        slab.max !== null && slab.max !== '' && slab.max !== undefined && !isNaN(Number(slab.max));
      const maxVal = hasMax ? Number(slab.max) : Infinity;
      if (amt <= maxVal) {
        return Number(slab.rate) || 0;
      }
    }

    // 3. Above all defined max brackets -> use highest slab if >= lowest min
    const lowestMin = Number(sorted[0].min) || 0;
    if (amt >= lowestMin) {
      return Number(sorted[sorted.length - 1].rate) || 0;
    }
    return 0;
  }

  return Number(rule.rate) || 0;
}

/**
 * Computes room accommodation tax dynamically according to active Tax Rules & Definitions.
 * Supports:
 * - Price Bracket Slabs (e.g. ₹1–₹7500 -> 5%, ₹7501–above -> 18%)
 * - Flat Rate mode (when Slabs toggle is OFF)
 * - Percentage (%) or Fixed Amount (₹) calculation modes
 * - EXCLUSIVE (added on top) and INCLUSIVE (extracted from price) modes
 * - Component Splits (e.g. CGST 50% + SGST 50%, or custom splits)
 * - Status Active toggle (inactive rules apply 0 tax)
 */
export function calculateRoomTax(tariffPerNight, nights = 1, options = {}) {
  const {
    isComplimentary = false,
    isTaxExempt = false,
    isInterstate = false,
    isTaxInclusive,
    taxRules: overrideTaxRules
  } = options;

  const nightlyTariff = Number(tariffPerNight) || 0;
  const stayNights = Math.max(1, Number(nights) || 1);
  const enteredTotal = round2(nightlyTariff * stayNights);

  const emptyResult = (baseAmt) => ({
    taxableAmount: baseAmt,
    gstRate: 0,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0,
    totalTax: 0,
    grossTotal: baseAmt,
    sacCode: SAC_CODES.ACCOMMODATION,
    splitsBreakdown: [],
    ruleName: '',
    ruleLabel: 'Tax',
    isTaxInclusive: Boolean(isTaxInclusive),
    calculationMode: 'percentage'
  });

  if (isComplimentary || isTaxExempt || nightlyTariff <= 0) {
    return emptyResult(isComplimentary ? 0 : enteredTotal);
  }

  const allRules = getConfiguredTaxRules(overrideTaxRules);
  const activeRules = allRules.filter((r) => r && r.status !== 'inactive');

  if (activeRules.length === 0) {
    return emptyResult(enteredTotal);
  }

  const primaryRule = activeRules[0];
  const effectiveInclusive =
    typeof isTaxInclusive === 'boolean'
      ? isTaxInclusive
      : String(primaryRule.priceInclusion || 'EXCLUSIVE').toUpperCase() === 'INCLUSIVE';

  // Aggregate percentage rules and fixed-amount rules
  let combinedPercentRate = 0;
  let combinedFixedPerNight = 0;
  const ruleMeta = [];

  activeRules.forEach((rule) => {
    const mode = String(rule.calculationMode || 'percentage').toLowerCase();
    const resolvedVal = resolveRuleRate(nightlyTariff, rule);
    if (resolvedVal <= 0) return;

    if (mode === 'fixed') {
      combinedFixedPerNight += resolvedVal;
    } else {
      combinedPercentRate += resolvedVal;
    }
    ruleMeta.push({ rule, mode, resolvedVal });
  });

  if (combinedPercentRate <= 0 && combinedFixedPerNight <= 0) {
    return emptyResult(enteredTotal);
  }

  let taxableAmount = 0;
  let totalTax = 0;
  let grossTotal = 0;

  const fixedTaxTotal = round2(combinedFixedPerNight * stayNights);

  if (effectiveInclusive) {
    // Entered price ALREADY includes both fixed and percentage taxes:
    // enteredTotal = taxableAmount * (1 + pct/100) + fixedTaxTotal
    const afterFixed = Math.max(0, enteredTotal - fixedTaxTotal);
    taxableAmount =
      combinedPercentRate > 0
        ? round2(afterFixed / (1 + combinedPercentRate / 100))
        : round2(afterFixed);
    totalTax = round2(Math.max(0, enteredTotal - taxableAmount));
    grossTotal = enteredTotal;
  } else {
    // EXCLUSIVE: Tax is added on top of entered price
    taxableAmount = enteredTotal;
    const pctTaxTotal =
      combinedPercentRate > 0 ? round2((taxableAmount * combinedPercentRate) / 100) : 0;
    totalTax = round2(pctTaxTotal + fixedTaxTotal);
    grossTotal = round2(taxableAmount + totalTax);
  }

  // Compute Component Splits (e.g. CGST 50% + SGST 50% or user-defined splits)
  const splitsBreakdown = [];
  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterstate) {
    igstRate = round2(combinedPercentRate);
    igstAmount = totalTax;
    splitsBreakdown.push({
      name: 'IGST',
      sharePct: 100,
      rate: igstRate,
      amount: igstAmount
    });
  } else {
    const pctTaxPool = round2(Math.max(0, totalTax - fixedTaxTotal));

    ruleMeta.forEach(({ rule, mode, resolvedVal }) => {
      const ruleTaxAmt =
        mode === 'fixed'
          ? round2(resolvedVal * stayNights)
          : combinedPercentRate > 0
          ? round2(pctTaxPool * (resolvedVal / combinedPercentRate))
          : 0;

      const configuredSplits =
        Array.isArray(rule.splits) && rule.splits.length > 0
          ? rule.splits
          : [{ name: rule.presentationLabel || rule.categoryType || 'TAX', share: 1 }];

      const totalShare = configuredSplits.reduce(
        (acc, sp) => acc + (parseFloat(sp.share) || 0),
        0
      );

      let allocated = 0;
      configuredSplits.forEach((sp, idx) => {
        const shareWeight = parseFloat(sp.share) || 0;
        const ratio =
          totalShare > 0 ? shareWeight / totalShare : 1 / configuredSplits.length;
        const isLast = idx === configuredSplits.length - 1;
        const spAmt = isLast
          ? round2(ruleTaxAmt - allocated)
          : round2(ruleTaxAmt * ratio);
        allocated = round2(allocated + spAmt);

        const spRate = mode === 'fixed' ? 0 : round2(resolvedVal * ratio);
        const spName = String(sp.name || 'TAX').trim().toUpperCase();

        splitsBreakdown.push({
          name: spName,
          sharePct: Math.round(ratio * 100),
          rate: spRate,
          amount: spAmt
        });

        if (spName === 'CGST') {
          cgstRate = round2(cgstRate + spRate);
          cgstAmount = round2(cgstAmount + spAmt);
        } else if (spName === 'SGST') {
          sgstRate = round2(sgstRate + spRate);
          sgstAmount = round2(sgstAmount + spAmt);
        } else if (spName === 'IGST') {
          igstRate = round2(igstRate + spRate);
          igstAmount = round2(igstAmount + spAmt);
        }
      });
    });

    // If custom split names were used (not CGST/SGST/IGST), keep legacy cgst/sgst fallback safe
    if (cgstAmount === 0 && sgstAmount === 0 && igstAmount === 0 && totalTax > 0) {
      cgstRate = round2(combinedPercentRate / 2);
      sgstRate = round2(combinedPercentRate / 2);
      cgstAmount = round2(totalTax / 2);
      sgstAmount = round2(totalTax - cgstAmount);
    }
  }

  return {
    taxableAmount,
    gstRate: round2(combinedPercentRate),
    fixedTaxPerNight: round2(combinedFixedPerNight),
    cgstRate,
    sgstRate,
    igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    grossTotal,
    sacCode: SAC_CODES.ACCOMMODATION,
    splitsBreakdown,
    ruleName: primaryRule.name || 'India Hotel Slab GST',
    ruleLabel: primaryRule.presentationLabel || primaryRule.categoryType || 'GST',
    isTaxInclusive: effectiveInclusive,
    calculationMode: primaryRule.calculationMode || 'percentage'
  };
}

/**
 * Formats GSTIN and extracts 2-digit state code
 */
export function getGstinStateCode(gstin) {
  if (!gstin || typeof gstin !== 'string' || gstin.trim().length < 2) return null;
  return gstin.trim().substring(0, 2);
}

/**
 * Checks if a guest GSTIN is interstate compared to property GSTIN
 */
export function isInterstateBilling(propertyGstin, guestGstin) {
  const propCode = getGstinStateCode(propertyGstin);
  const guestCode = getGstinStateCode(guestGstin);
  if (!propCode || !guestCode) return false;
  return propCode !== guestCode;
}

/**
 * Aggregates all debit transactions of a folio into legal GST invoice rows
 * honoring live Tax Rules & Definitions for accommodation charges.
 */
export function generateTaxInvoiceSummary(transactions = [], property, guest, overrideTaxRules) {
  const isInterstate = isInterstateBilling(property?.gstin, guest?.gstin);

  const lineItems = [];
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalGross = 0;

  transactions.forEach((tx, idx) => {
    if (tx.direction !== 'DEBIT' && tx.amount <= 0) return; // Skip payments/credits

    const isFnb = tx.type === 'EXTRA_SERVICE' || tx.type === 'FNB';
    const sacCode = isFnb ? SAC_CODES.RESTAURANT_FNB : SAC_CODES.ACCOMMODATION;
    const baseAmount = Number(tx.amount) || 0;

    let taxRate = 0;
    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let taxableValue = baseAmount;
    let rowTotal = baseAmount;

    if (isFnb) {
      taxRate = 5;
      if (isInterstate) {
        igstRate = taxRate;
        igst = round2((baseAmount * taxRate) / 100);
      } else {
        cgstRate = taxRate / 2;
        sgstRate = taxRate / 2;
        cgst = round2((baseAmount * cgstRate) / 100);
        sgst = round2((baseAmount * sgstRate) / 100);
      }
      rowTotal = round2(baseAmount + cgst + sgst + igst);
    } else {
      const calc = calculateRoomTax(baseAmount, 1, {
        isInterstate,
        isTaxInclusive: tx.isTaxInclusive,
        taxRules: overrideTaxRules
      });
      taxableValue = calc.taxableAmount;
      taxRate = calc.gstRate;
      cgstRate = calc.cgstRate;
      sgstRate = calc.sgstRate;
      igstRate = calc.igstRate;
      cgst = calc.cgstAmount;
      sgst = calc.sgstAmount;
      igst = calc.igstAmount;
      rowTotal = calc.grossTotal;
    }

    lineItems.push({
      itemIndex: idx + 1,
      date: tx.date || property?.businessDate,
      description: tx.desc || (isFnb ? 'Food & Beverage Service' : 'Hotel Accommodation Room Tariff'),
      sacCode,
      taxableValue,
      taxRate,
      cgstRate,
      cgstAmount: cgst,
      sgstRate,
      sgstAmount: sgst,
      igstRate,
      igstAmount: igst,
      totalAmount: rowTotal
    });

    totalTaxable = round2(totalTaxable + taxableValue);
    totalCgst = round2(totalCgst + cgst);
    totalSgst = round2(totalSgst + sgst);
    totalIgst = round2(totalIgst + igst);
    totalGross = round2(totalGross + rowTotal);
  });

  return {
    lineItems,
    totalTaxable,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTax: round2(totalCgst + totalSgst + totalIgst),
    totalGross,
    isInterstate
  };
}
