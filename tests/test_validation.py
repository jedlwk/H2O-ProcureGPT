"""
Tests for the per-field validation engine.
"""
import pytest
from procurement.services.validation import (
    FieldStatus, FieldValidationResult, RecordValidationResult,
    validate_record_fields, validate_record, validate_records,
    is_empty_value, parse_date, get_missing_fields,
    check_price_anomaly, get_validation_summary,
)


class TestIsEmptyValue:
    def test_none(self):
        assert is_empty_value(None) is True

    def test_empty_string(self):
        assert is_empty_value('') is True

    def test_na_variants(self):
        assert is_empty_value('NA') is True
        assert is_empty_value('N/A') is True
        assert is_empty_value('NaN') is True
        assert is_empty_value('NULL') is True
        assert is_empty_value('None') is True

    def test_valid_value(self):
        assert is_empty_value('hello') is False
        assert is_empty_value(123) is False
        assert is_empty_value(0) is False

    def test_nan_float(self):
        import math
        assert is_empty_value(float('nan')) is True


class TestParseDate:
    def test_valid_iso(self):
        result = parse_date('2024-01-15')
        assert result is not None
        assert result.year == 2024

    def test_valid_formats(self):
        assert parse_date('15-Jan-24') is not None
        assert parse_date('01/15/2024') is not None

    def test_invalid(self):
        assert parse_date('abc') is None
        assert parse_date('') is None
        assert parse_date(None) is None


class TestValidateRecordFields:
    def _make_valid_record(self):
        return {
            'sku': 'C9300-48P-A',
            'distributor': 'Ingram Micro',
            'item_description': 'Catalyst 9300 48-port PoE+ Switch',
            'quote_currency': 'SGD',
            'quantity': 5,
            'serial_no': 'SN12345',
            'unit_price': 8500.00,
            'total_price': 42500.00,
            'eu_company': 'ABC Holdings Pte Ltd',
            'quotation_ref_no': 'QUO-1234567',
            'start_date': '2024-01-15',
            'end_date': '2025-01-15',
            'quotation_date': '2024-01-01',
            'quotation_end_date': '2024-02-01',
        }

    def test_valid_record_all_green(self):
        record = self._make_valid_record()
        result = validate_record_fields(record)
        assert result.overall_status in (FieldStatus.VALID, FieldStatus.WARNING)
        # Check that core fields are valid
        assert result.field_results['sku'].status == FieldStatus.VALID
        assert result.field_results['distributor'].status == FieldStatus.VALID

    def test_missing_compulsory_field_red(self):
        record = self._make_valid_record()
        record['sku'] = ''
        result = validate_record_fields(record)
        assert result.field_results['sku'].status == FieldStatus.ERROR
        assert result.overall_status == FieldStatus.ERROR

    def test_negative_price_red(self):
        record = self._make_valid_record()
        record['unit_price'] = -100
        result = validate_record_fields(record)
        assert result.field_results['unit_price'].status == FieldStatus.ERROR

    def test_zero_quantity_red(self):
        record = self._make_valid_record()
        record['quantity'] = 0
        result = validate_record_fields(record)
        assert result.field_results['quantity'].status == FieldStatus.ERROR

    def test_price_anomaly_yellow(self):
        record = self._make_valid_record()
        record['unit_price'] = 130.0  # 30% above historical avg of 100
        result = validate_record_fields(record, historical_avg=100.0)
        assert result.field_results['unit_price'].status == FieldStatus.WARNING

    def test_price_anomaly_red(self):
        record = self._make_valid_record()
        record['unit_price'] = 160.0  # 60% above historical avg of 100
        result = validate_record_fields(record, historical_avg=100.0)
        assert result.field_results['unit_price'].status == FieldStatus.ERROR

    def test_date_ordering_error(self):
        record = self._make_valid_record()
        record['start_date'] = '2025-06-01'
        record['end_date'] = '2024-01-01'
        result = validate_record_fields(record)
        # One of the date fields should have an error
        start_status = result.field_results.get('start_date', FieldValidationResult(FieldStatus.VALID))
        end_status = result.field_results.get('end_date', FieldValidationResult(FieldStatus.VALID))
        assert start_status.status == FieldStatus.ERROR or end_status.status == FieldStatus.ERROR

    def test_total_mismatch_warning(self):
        record = self._make_valid_record()
        record['quantity'] = 5
        record['unit_price'] = 100
        record['total_price'] = 1000  # Should be 500
        result = validate_record_fields(record)
        assert result.field_results['total_price'].status in (FieldStatus.WARNING, FieldStatus.ERROR)

    def test_short_sku_warning(self):
        record = self._make_valid_record()
        record['sku'] = 'AB'
        result = validate_record_fields(record)
        assert result.field_results['sku'].status == FieldStatus.WARNING

    def test_unsupported_currency_warning(self):
        record = self._make_valid_record()
        record['quote_currency'] = 'ZZZ'
        result = validate_record_fields(record)
        assert result.field_results['quote_currency'].status == FieldStatus.WARNING

    def test_high_quantity_warning(self):
        record = self._make_valid_record()
        record['quantity'] = 15000
        record['total_price'] = 15000 * 8500
        result = validate_record_fields(record)
        assert result.field_results['quantity'].status == FieldStatus.WARNING


class TestValidateRecordBackwardCompat:
    def test_returns_tuple(self):
        record = {
            'sku': 'TEST-123', 'distributor': 'Test Dist',
            'item_description': 'Test Item', 'quote_currency': 'SGD',
            'quantity': 1, 'serial_no': 'SN1', 'unit_price': 100,
            'total_price': 100, 'eu_company': 'Test Co',
            'quotation_ref_no': 'REF-001'
        }
        status, message = validate_record(record)
        assert status in ('valid', 'warning', 'error')
        assert isinstance(message, str)


class TestValidateRecords:
    def test_adds_field_validation(self):
        records = [{
            'sku': 'TEST-123', 'distributor': 'Test Dist',
            'item_description': 'Test Item', 'quote_currency': 'SGD',
            'quantity': 1, 'serial_no': 'SN1', 'unit_price': 100,
            'total_price': 100, 'eu_company': 'Test Co',
            'quotation_ref_no': 'REF-001'
        }]
        result = validate_records(records)
        assert len(result) == 1
        assert 'field_validation' in result[0]
        assert 'validation_status' in result[0]
        assert 'validation_message' in result[0]

    def test_duplicate_detection(self):
        record = {
            'sku': 'DUPE-SKU', 'distributor': 'Dist',
            'item_description': 'Item', 'quote_currency': 'SGD',
            'quantity': 1, 'serial_no': 'SN1', 'unit_price': 100,
            'total_price': 100, 'eu_company': 'Co',
            'quotation_ref_no': 'REF-001'
        }
        records = [record.copy(), record.copy()]
        result = validate_records(records)
        # At least one should have a warning about duplicate
        has_dup_warning = any('duplicate' in r.get('validation_message', '').lower() for r in result)
        assert has_dup_warning


class TestCheckPriceAnomaly:
    def test_no_anomaly(self):
        record = {'unit_price': 100}
        is_anomaly, msg = check_price_anomaly(record, 95.0)
        assert is_anomaly is False

    def test_anomaly_detected(self):
        record = {'unit_price': 200}
        is_anomaly, msg = check_price_anomaly(record, 100.0)
        assert is_anomaly is True
        assert msg is not None

    def test_no_historical(self):
        record = {'unit_price': 100}
        is_anomaly, msg = check_price_anomaly(record, 0)
        assert is_anomaly is False


class TestGetMissingFields:
    def test_all_present(self):
        record = {
            'sku': 'X', 'distributor': 'Y', 'item_description': 'Z',
            'quote_currency': 'SGD', 'quantity': 1, 'serial_no': 'SN',
            'unit_price': 10, 'total_price': 10, 'eu_company': 'Co',
            'quotation_ref_no': 'REF'
        }
        assert get_missing_fields(record) == []

    def test_missing_fields(self):
        record = {'sku': 'X'}
        missing = get_missing_fields(record)
        assert 'distributor' in missing
        assert 'item_description' in missing


class TestGetValidationSummary:
    def test_summary(self):
        records = [
            {'validation_status': 'valid'},
            {'validation_status': 'warning'},
            {'validation_status': 'error'},
        ]
        summary = get_validation_summary(records)
        assert summary['total'] == 3
        assert summary['valid'] == 1
        assert summary['warning'] == 1
        assert summary['error'] == 1
