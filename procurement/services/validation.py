"""
Validation engine for procurement records.
Three-tier status: Valid (green), Warning (amber), Error (red).
Operates at per-field, cross-field, and batch levels.
"""
import math
import re
from dataclasses import dataclass, field
from datetime import datetime
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


@dataclass
class RecordValidationResult:
    overall_status: FieldStatus
    field_results: dict = field(default_factory=dict)


# Compulsory text fields (non-numeric)
_COMPULSORY_TEXT = {
    'sku', 'distributor', 'item_description', 'quote_currency',
    'serial_no', 'eu_company', 'quotation_ref_no',
}
# Compulsory numeric fields
_COMPULSORY_NUMERIC = {'quantity', 'unit_price', 'total_price'}


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
) -> RecordValidationResult:
    """Validate all fields of a single record. Returns per-field results."""
    results = {}
    worst = FieldStatus.VALID

    def _set(field_name: str, status: FieldStatus, message: str = ""):
        nonlocal worst
        results[field_name] = FieldValidationResult(status, message)
        if status == FieldStatus.ERROR:
            worst = FieldStatus.ERROR
        elif status == FieldStatus.WARNING and worst != FieldStatus.ERROR:
            worst = FieldStatus.WARNING

    # --- Text field validation ---
    for f in _COMPULSORY_TEXT:
        val = record.get(f)
        if is_empty_value(val):
            _set(f, FieldStatus.ERROR, f"Missing compulsory field: {f}")
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

    # --- Numeric field validation ---
    for f in _COMPULSORY_NUMERIC:
        raw = record.get(f)
        num = _to_numeric(raw)

        if num is None:
            _set(f, FieldStatus.ERROR, f"Missing compulsory field: {f}")
            continue

        if num < 0:
            _set(f, FieldStatus.ERROR, f"Negative value for {f}: {num}")
            continue

        if f == 'quantity' and num == 0:
            _set(f, FieldStatus.ERROR, "Quantity cannot be zero")
            continue

        # Quantity outlier checks
        if f == 'quantity' and num > 10000:
            _set(f, FieldStatus.WARNING, f"High quantity: {num}")
            continue

        # Set valid if no issues found
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


def validate_records(records: list[dict]) -> list[dict]:
    """Validate a batch of records. Adds validation fields + duplicate detection."""
    # Per-record validation
    for rec in records:
        result = validate_record_fields(rec)
        rec['validation_status'] = result.overall_status.value
        messages = []
        field_val = {}
        for f, fv in result.field_results.items():
            field_val[f] = {'status': fv.status.value, 'message': fv.message}
            if fv.status != FieldStatus.VALID and fv.message:
                messages.append(fv.message)
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
