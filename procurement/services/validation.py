"""
Validation engine for procurement records.
Three-tier status: Valid (green), Warning (amber), Error (red).
Operates at per-field, cross-field, and batch levels.
"""
import difflib
import math
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from enum import Enum

from procurement.config.settings import COMPULSORY_FIELDS, SUPPORTED_CURRENCIES


class FieldStatus(Enum):
    VALID = 'valid'
    WARNING = 'warning'
    ERROR = 'error'


@dataclass
class FieldValidationResult:
    status: FieldStatus
    message: str = ""
    suggestion: str = ""


@dataclass
class RecordValidationResult:
    overall_status: FieldStatus
    field_results: dict = field(default_factory=dict)


# Fields that are errors when missing (critical fields)
_ERROR_TEXT = {'sku', 'item_description'}
_ERROR_NUMERIC = {'quantity', 'unit_price'}

# Fields that are warnings when missing (non-critical but expected)
_WARNING_TEXT = {'eu_company', 'distributor', 'quote_currency', 'serial_no', 'quotation_ref_no'}
_WARNING_NUMERIC = {'total_price'}


def is_empty_value(value) -> bool:
    """Check if a value is empty or a placeholder."""
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    if isinstance(value, str):
        return value.strip().upper() in ('', 'NA', 'N/A', 'NAN', 'NULL', 'NONE')
    return False


def parse_date(date_str) -> "datetime | None":
    """Parse a date string in multiple formats. Returns None if unparseable."""
    if date_str is None or (isinstance(date_str, str) and date_str.strip() == ''):
        return None

    if not isinstance(date_str, str):
        return None

    date_str = date_str.strip()

    formats = [
        '%Y-%m-%d',       # ISO: 2024-01-15
        '%Y-%m-%dT%H:%M:%S',
        '%m/%d/%Y',       # US: 01/15/2024
        '%d-%b-%y',       # European: 15-Jan-24
        '%d-%b-%Y',       # European full: 15-Jan-2024
        '%d/%m/%Y',       # DD/MM/YYYY
        '%Y%m%d',         # Compact: 20240115
        '%b %d, %Y',      # Jan 15, 2024
        '%d %b %Y',       # 15 Jan 2024
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    return None


def _to_numeric(value) -> "float | None":
    """Convert a value to float, returning None if not possible."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        if math.isnan(value):
            return None
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace(',', '').replace('$', '').replace(' ', '')
        if cleaned == '' or cleaned.upper() in ('NA', 'N/A', 'NAN', 'NULL', 'NONE'):
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def validate_record_fields(
    record: dict,
    historical_avg: float = 0.0,
    historical_stats: Optional[dict] = None,
) -> RecordValidationResult:
    """Validate all fields of a single record. Returns per-field results."""
    results = {}
    worst = FieldStatus.VALID

    def _set(field_name: str, status: FieldStatus, message: str = "", suggestion: str = ""):
        nonlocal worst
        results[field_name] = FieldValidationResult(status, message, suggestion)
        if status == FieldStatus.ERROR:
            worst = FieldStatus.ERROR
        elif status == FieldStatus.WARNING and worst != FieldStatus.ERROR:
            worst = FieldStatus.WARNING

    # --- Error-level text fields (critical) ---
    for f in _ERROR_TEXT:
        val = record.get(f)
        if is_empty_value(val):
            _set(f, FieldStatus.ERROR, f"Missing required field: {f}")
        else:
            _set(f, FieldStatus.VALID)

    # --- Warning-level text fields (expected but not critical) ---
    for f in _WARNING_TEXT:
        val = record.get(f)
        if is_empty_value(val):
            _set(f, FieldStatus.WARNING, f"Missing field: {f}")
        else:
            _set(f, FieldStatus.VALID)

    # SKU length check
    sku_val = record.get('sku')
    if not is_empty_value(sku_val) and isinstance(sku_val, str) and len(sku_val.strip()) < 3:
        _set('sku', FieldStatus.WARNING, f"SKU '{sku_val}' has fewer than 3 characters")

    # Currency validation
    currency = record.get('quote_currency')
    if not is_empty_value(currency) and isinstance(currency, str):
        if currency.strip().upper() not in SUPPORTED_CURRENCIES:
            _set('quote_currency', FieldStatus.WARNING,
                 f"Unsupported currency: {currency}")

    # --- Error-level numeric fields (critical) ---
    for f in _ERROR_NUMERIC:
        raw = record.get(f)
        num = _to_numeric(raw)

        if num is None:
            _set(f, FieldStatus.ERROR, f"Missing required field: {f}")
            continue

        if num < 0:
            _set(f, FieldStatus.ERROR, f"Negative value for {f}: {num}")
            continue

        if f == 'quantity' and num == 0:
            _set(f, FieldStatus.ERROR, "Quantity cannot be zero")
            continue

        if f == 'quantity' and num > 10000:
            _set(f, FieldStatus.WARNING, f"High quantity: {num}")
            continue

        if f not in results or results[f].status == FieldStatus.VALID:
            _set(f, FieldStatus.VALID)

    # --- Warning-level numeric fields (expected but not critical) ---
    for f in _WARNING_NUMERIC:
        raw = record.get(f)
        num = _to_numeric(raw)

        if num is None:
            _set(f, FieldStatus.WARNING, f"Missing field: {f}")
            continue

        if num < 0:
            _set(f, FieldStatus.ERROR, f"Negative value for {f}: {num}")
            continue

        if f not in results or results[f].status == FieldStatus.VALID:
            _set(f, FieldStatus.VALID)

    # --- Price anomaly vs historical ---
    unit_price = _to_numeric(record.get('unit_price'))
    if unit_price is not None and historical_avg > 0:
        deviation = abs(unit_price - historical_avg) / historical_avg
        if deviation >= 0.50:
            _set('unit_price', FieldStatus.ERROR,
                 f"Unit price ({unit_price:.2f}) deviates {deviation*100:.0f}% from historical avg ({historical_avg:.2f})")
        elif deviation >= 0.20:
            _set('unit_price', FieldStatus.WARNING,
                 f"Unit price ({unit_price:.2f}) deviates {deviation*100:.0f}% from historical avg ({historical_avg:.2f})")

    # --- Total price mismatch ---
    quantity = _to_numeric(record.get('quantity'))
    total_price = _to_numeric(record.get('total_price'))
    if unit_price is not None and quantity is not None and quantity > 0 and total_price is not None:
        expected = unit_price * quantity
        if expected > 0:
            diff_pct = abs(total_price - expected) / expected
            if diff_pct > 0.01:
                _set('total_price', FieldStatus.WARNING,
                     f"Total ({total_price:.2f}) differs from unit price x quantity ({expected:.2f}) by {diff_pct*100:.1f}%")

    # --- Date validation ---
    date_fields = ['start_date', 'end_date', 'quotation_date', 'quotation_end_date']
    parsed_dates = {}
    for f in date_fields:
        raw = record.get(f)
        if is_empty_value(raw):
            # Optional fields — valid if empty
            if f not in results:
                _set(f, FieldStatus.VALID)
            continue

        dt = parse_date(raw)
        if dt is None:
            _set(f, FieldStatus.ERROR, f"Cannot parse date: {raw}")
        else:
            parsed_dates[f] = dt
            if f not in results:
                _set(f, FieldStatus.VALID)

    # Start date after end date
    if 'start_date' in parsed_dates and 'end_date' in parsed_dates:
        if parsed_dates['start_date'] > parsed_dates['end_date']:
            _set('start_date', FieldStatus.ERROR, "Start date is after end date")
            _set('end_date', FieldStatus.ERROR, "End date is before start date")

    # Quotation date ordering
    if 'quotation_date' in parsed_dates and 'quotation_end_date' in parsed_dates:
        if parsed_dates['quotation_date'] > parsed_dates['quotation_end_date']:
            _set('quotation_date', FieldStatus.ERROR, "Quotation date is after quotation end date")

    # --- Decimal error detection (price > 5x historical AND price/100 within 30% of avg) ---
    hist = historical_stats or {}
    sku_key = (record.get('sku') or '').strip()
    sku_hist = hist.get(sku_key, {})
    hist_avg = sku_hist.get('avg_price') if sku_hist else None
    if hist_avg is None:
        hist_avg = historical_avg if historical_avg > 0 else None

    if unit_price is not None and hist_avg and hist_avg > 0:
        if unit_price > 5 * hist_avg:
            divided = unit_price / 100
            if abs(divided - hist_avg) / hist_avg <= 0.30:
                _set('unit_price', FieldStatus.WARNING,
                     f"Possible decimal error: {unit_price:.2f} may be {divided:.2f} (historical avg {hist_avg:.2f})",
                     suggestion=str(round(divided, 2)))

    # --- Short description ---
    desc_val = record.get('item_description')
    if not is_empty_value(desc_val) and isinstance(desc_val, str) and len(desc_val.strip()) < 5:
        _set('item_description', FieldStatus.WARNING, f"Description is very short ({len(desc_val.strip())} chars)")

    # --- Round number warning ---
    if unit_price is not None and hist_avg and hist_avg > 0:
        if unit_price > 0 and unit_price % 100 == 0:
            # Check if historical avg has decimals (i.e. not a round number)
            if hist_avg % 1 != 0:
                # Only warn if not already flagged for bigger issues
                if 'unit_price' not in results or results['unit_price'].status == FieldStatus.VALID:
                    _set('unit_price', FieldStatus.WARNING,
                         f"Round number ({unit_price:.0f}) — historical avg has decimals ({hist_avg:.2f})")

    # Optional fields that aren't yet in results
    optional_fields = ['brand', 'comments_notes', 'quotation_validity']
    for f in optional_fields:
        if f not in results:
            _set(f, FieldStatus.VALID)

    return RecordValidationResult(overall_status=worst, field_results=results)


def validate_record(record: dict) -> tuple:
    """Backward-compatible wrapper. Returns (status_string, message_string)."""
    result = validate_record_fields(record)

    messages = []
    for f, fv in result.field_results.items():
        if fv.status != FieldStatus.VALID and fv.message:
            messages.append(fv.message)

    status_str = result.overall_status.value
    message_str = '; '.join(messages) if messages else 'All fields valid'
    return status_str, message_str


def _pdf_fallback_lookup(sku: str, description: str = None) -> "dict | None":
    """Check PDF catalog cache, then query reference PDFs if not cached.

    Returns a dict with {found, base_price, item_description, brand} or None.
    """
    from procurement.services.database import (
        get_pdf_cache_entry,
        save_pdf_cache_entry,
        get_reference_documents,
    )

    # Check cache first
    cached = get_pdf_cache_entry(sku)
    if cached is not None:
        return cached

    # Query each reference document collection
    ref_docs = get_reference_documents()
    if not ref_docs:
        # No reference PDFs uploaded — cache as not-found and return
        save_pdf_cache_entry(sku, found=False)
        return None

    try:
        from procurement.services.llm_service import query_catalog_pdf
    except Exception:
        return None

    for doc in ref_docs:
        try:
            result = query_catalog_pdf(doc['collection_id'], sku, description)
            if result and result.get('found'):
                save_pdf_cache_entry(
                    sku,
                    found=True,
                    base_price=result.get('base_price'),
                    item_description=result.get('item_description'),
                    brand=result.get('brand'),
                    raw_response=result.get('raw_response'),
                )
                return result
        except Exception:
            continue

    # Not found in any reference PDF — cache negative result
    save_pdf_cache_entry(sku, found=False)
    return None


def validate_records(records: list[dict], known_skus: list[str] = None, catalog_entries: dict = None, historical_stats: dict = None) -> list[dict]:
    """Validate a batch of records. Adds validation fields + duplicate detection + fuzzy SKU matching + catalog validation."""
    # Normalize known_skus to uppercase for case-insensitive matching
    known_skus_upper = [s.upper() for s in (known_skus or [])]

    # Preserve acknowledged state from incoming records
    acknowledged_map: dict[int, dict[str, bool]] = {}
    for i, rec in enumerate(records):
        fv = rec.get('field_validation') or {}
        ack = {}
        for field_name, field_data in fv.items():
            if isinstance(field_data, dict) and field_data.get('acknowledged'):
                ack[field_name] = True
        if ack:
            acknowledged_map[i] = ack

    # Per-record validation
    for rec in records:
        result = validate_record_fields(rec, historical_stats=historical_stats)
        rec['validation_status'] = result.overall_status.value
        messages = []
        field_val = {}
        for f, fv in result.field_results.items():
            field_val[f] = {'status': fv.status.value, 'message': fv.message, 'suggestion': fv.suggestion}
            if fv.status != FieldStatus.VALID and fv.message:
                messages.append(fv.message)

        # Fuzzy SKU matching
        if known_skus and 'sku' in field_val:
            sku = (rec.get('sku') or '').strip()
            if sku:
                sku_upper = sku.upper()
                matches = difflib.get_close_matches(sku_upper, known_skus_upper, n=1, cutoff=0.7)
                if matches and matches[0] != sku_upper:
                    # Found a fuzzy match
                    suggestion = next((s for s in known_skus if s.upper() == matches[0]), None)
                    if suggestion:
                        field_val['sku']['suggestion'] = suggestion
                        # Escalate to warning if currently valid
                        if field_val['sku']['status'] == 'valid':
                            field_val['sku']['status'] = 'warning'
                            messages.append(f"SKU '{sku}' is close to known SKU '{suggestion}' (fuzzy match)")

        # Catalog validation
        if catalog_entries and 'sku' in field_val:
            sku = (rec.get('sku') or '').strip()
            if sku and sku in catalog_entries:
                rec['catalog_match'] = True
                catalog = catalog_entries[sku]
                unit_price = _to_numeric(rec.get('unit_price'))

                if unit_price is not None and catalog.get('max_price'):
                    max_price = catalog['max_price']
                    deviation = (unit_price - max_price) / max_price if max_price > 0 else 0

                    if deviation > 0.50:
                        # >50% over max price
                        field_val['unit_price']['status'] = 'error'
                        msg = f"Unit price ({unit_price:.2f}) exceeds catalog max price ({max_price:.2f}) by {deviation*100:.0f}%"
                        field_val['unit_price']['message'] = msg
                        messages.append(msg)
                        rec['validation_status'] = 'error'
                    elif deviation > 0.10:
                        # >10% over max price
                        field_val['unit_price']['status'] = 'warning'
                        msg = f"Unit price ({unit_price:.2f}) exceeds catalog max price ({max_price:.2f}) by {deviation*100:.0f}%"
                        field_val['unit_price']['message'] = msg
                        messages.append(msg)
                        if rec['validation_status'] == 'valid':
                            rec['validation_status'] = 'warning'

        # PDF catalog fallback — when no structured catalog match
        if not rec.get('catalog_match'):
            sku = (rec.get('sku') or '').strip()
            if sku:
                pdf_result = _pdf_fallback_lookup(sku, rec.get('item_description'))
                if pdf_result and pdf_result.get('found'):
                    rec['catalog_match'] = True
                    rec['pdf_fallback'] = True
                    msg = "Matched from reference PDF"
                    if pdf_result.get('base_price') is not None:
                        msg += f" (base price: {pdf_result['base_price']:.2f})"
                    field_val['sku'] = {
                        'status': field_val.get('sku', {}).get('status', 'valid'),
                        'message': msg,
                        'suggestion': field_val.get('sku', {}).get('suggestion', ''),
                    }
                    messages.append(msg)

        rec['validation_message'] = '; '.join(messages) if messages else 'All fields valid'
        rec['field_validation'] = field_val

    # Batch-level duplicate detection
    composite_keys = {}
    for i, rec in enumerate(records):
        sku = (rec.get('sku') or '').strip().upper()
        unit_price = _to_numeric(rec.get('unit_price'))
        quantity = _to_numeric(rec.get('quantity'))
        key = (sku, unit_price, quantity)
        composite_keys.setdefault(key, []).append(i)

    for key, indices in composite_keys.items():
        if len(indices) >= 2:
            sku_display = key[0] or 'Unknown'
            msg = f"Possible duplicate: SKU {sku_display} appears {len(indices)} times with same price and quantity"
            for idx in indices:
                rec = records[idx]
                fv = rec.get('field_validation', {})
                fv['sku'] = {'status': 'warning', 'message': msg}
                rec['field_validation'] = fv

                # Upgrade overall status
                if rec.get('validation_status') == 'valid':
                    rec['validation_status'] = 'warning'

                # Append to message
                existing_msg = rec.get('validation_message', '')
                if existing_msg and existing_msg != 'All fields valid':
                    rec['validation_message'] = f"{existing_msg}; {msg}"
                else:
                    rec['validation_message'] = msg

    # --- Batch-level: price outlier vs SKU historical median ---
    hist = historical_stats or {}
    for i, rec in enumerate(records):
        price = _to_numeric(rec.get('unit_price'))
        if price is None or price <= 0:
            continue
        sku_key = (rec.get('sku') or '').strip()
        sku_hist = hist.get(sku_key, {})
        median_price = sku_hist.get('avg_price')
        if not median_price or median_price <= 0:
            continue
        ratio = price / median_price
        if ratio > 3 or ratio < 0.33:
            fv = rec.get('field_validation', {})
            msg = f"Batch outlier: price {price:.2f} vs SKU median {median_price:.2f} ({ratio:.1f}x)"
            if fv.get('unit_price', {}).get('status') not in ('error',):
                fv['unit_price'] = {'status': 'warning', 'message': msg,
                                    'suggestion': fv.get('unit_price', {}).get('suggestion', '')}
                rec['field_validation'] = fv
                if rec.get('validation_status') == 'valid':
                    rec['validation_status'] = 'warning'
                existing_msg = rec.get('validation_message', '')
                if existing_msg and existing_msg != 'All fields valid':
                    rec['validation_message'] = f"{existing_msg}; {msg}"
                else:
                    rec['validation_message'] = msg

    # --- Batch-level: currency inconsistency ---
    currencies_used = set()
    for rec in records:
        cur = rec.get('quote_currency')
        if not is_empty_value(cur) and isinstance(cur, str):
            currencies_used.add(cur.strip().upper())

    if len(currencies_used) > 1:
        currency_list = ', '.join(sorted(currencies_used))
        for rec in records:
            fv = rec.get('field_validation', {})
            cur_fv = fv.get('quote_currency', {})
            if cur_fv.get('status') not in ('error',):
                msg = f"Mixed currencies in batch: {currency_list}"
                fv['quote_currency'] = {'status': 'warning', 'message': msg,
                                        'suggestion': cur_fv.get('suggestion', '')}
                rec['field_validation'] = fv
                if rec.get('validation_status') == 'valid':
                    rec['validation_status'] = 'warning'

    # --- Batch-level: date outlier (>2 years from batch median) ---
    parsed_quote_dates: list[tuple[int, datetime]] = []
    for i, rec in enumerate(records):
        raw = rec.get('quotation_date')
        if not is_empty_value(raw):
            dt = parse_date(raw)
            if dt:
                parsed_quote_dates.append((i, dt))

    if len(parsed_quote_dates) >= 2:
        sorted_dates = sorted(d for _, d in parsed_quote_dates)
        median_date = sorted_dates[len(sorted_dates) // 2]
        for idx, dt in parsed_quote_dates:
            diff_days = abs((dt - median_date).days)
            if diff_days > 730:  # >2 years
                rec = records[idx]
                fv = rec.get('field_validation', {})
                msg = f"Date outlier: {rec.get('quotation_date')} is {diff_days // 365}+ years from batch median"
                fv['quotation_date'] = {'status': 'warning', 'message': msg, 'suggestion': ''}
                rec['field_validation'] = fv
                if rec.get('validation_status') == 'valid':
                    rec['validation_status'] = 'warning'

    # Restore acknowledged state
    for i, ack_fields in acknowledged_map.items():
        if i < len(records):
            fv = records[i].get('field_validation', {})
            for field_name in ack_fields:
                if field_name in fv:
                    fv[field_name]['acknowledged'] = True
            records[i]['field_validation'] = fv

    # Recalculate overall status ignoring acknowledged fields
    for rec in records:
        fv = rec.get('field_validation', {})
        worst_status = 'valid'
        for field_data in fv.values():
            if isinstance(field_data, dict) and field_data.get('acknowledged'):
                continue
            st = field_data.get('status', 'valid') if isinstance(field_data, dict) else 'valid'
            if st == 'error':
                worst_status = 'error'
                break
            elif st == 'warning' and worst_status != 'error':
                worst_status = 'warning'
        rec['validation_status'] = worst_status

    return records


def get_missing_fields(record: dict) -> list[str]:
    """Return list of compulsory fields that are missing or empty."""
    missing = []
    for f in COMPULSORY_FIELDS:
        if is_empty_value(record.get(f)):
            missing.append(f)
    return sorted(missing)


def check_price_anomaly(record: dict, historical_avg: float) -> tuple:
    """Check if unit_price deviates significantly from historical average.
    Returns (is_anomaly: bool, message: str | None)."""
    if historical_avg <= 0:
        return False, None

    unit_price = _to_numeric(record.get('unit_price'))
    if unit_price is None:
        return False, None

    deviation = abs(unit_price - historical_avg) / historical_avg
    if deviation >= 0.20:
        direction = "above" if unit_price > historical_avg else "below"
        msg = f"Unit price ({unit_price:.2f}) is {deviation*100:.0f}% {direction} historical average ({historical_avg:.2f})"
        return True, msg

    return False, None


def get_validation_summary(records: list[dict]) -> dict:
    """Count records by validation status."""
    summary = {'total': len(records), 'valid': 0, 'warning': 0, 'error': 0}
    for rec in records:
        status = rec.get('validation_status', 'pending')
        if status in summary:
            summary[status] += 1
    return summary
