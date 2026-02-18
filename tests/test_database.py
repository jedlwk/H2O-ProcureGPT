"""
Tests for the database service using in-memory SQLite.
"""
import pytest
import sqlite3
from unittest.mock import patch
from procurement.services.database import (
    init_db, get_db_connection, insert_record, get_record_by_id,
    update_record, delete_record, get_current_records,
    save_approved_records, search_historical_records,
    get_historical_stats, get_dashboard_metrics,
    get_price_trend_by_sku, get_records_added_this_month,
    ALLOWED_UPDATE_COLUMNS,
)
from procurement.config.settings import DATABASE_PATH
from pathlib import Path
import tempfile
import os


@pytest.fixture
def temp_db(tmp_path):
    """Create a temporary database for testing."""
    db_path = tmp_path / "test.db"
    with patch('procurement.services.database.DATABASE_PATH', db_path):
        init_db()
        yield db_path


class TestInitDb:
    def test_creates_tables(self, temp_db):
        with patch('procurement.services.database.DATABASE_PATH', temp_db):
            conn = sqlite3.connect(str(temp_db))
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = {row[0] for row in cursor.fetchall()}
            conn.close()

            assert 'records' in tables
            assert 'historical_archive' in tables
            assert 'uploaded_files' in tables
            assert 'change_log' in tables


class TestInsertAndGetRecord:
    def test_insert_and_retrieve(self, temp_db):
        with patch('procurement.services.database.DATABASE_PATH', temp_db):
            record = {
                'sku': 'TEST-001',
                'distributor': 'Test Dist',
                'item_description': 'Test Item',
                'unit_price': 100.0,
                'quantity': 5,
                'total_price': 500.0,
                'is_current': 1,
            }
            record_id = insert_record(record)
            assert record_id > 0

            fetched = get_record_by_id(record_id)
            assert fetched is not None
            assert fetched['sku'] == 'TEST-001'
            assert fetched['unit_price'] == 100.0


class TestUpdateRecord:
    def test_update_allowed_column(self, temp_db):
        with patch('procurement.services.database.DATABASE_PATH', temp_db):
            record_id = insert_record({'sku': 'UPD-001', 'unit_price': 100, 'is_current': 1})
            result = update_record(record_id, {'unit_price': 200.0})
            assert result is True

            fetched = get_record_by_id(record_id)
            assert fetched['unit_price'] == 200.0

    def test_rejects_disallowed_column(self, temp_db):
        with patch('procurement.services.database.DATABASE_PATH', temp_db):
            record_id = insert_record({'sku': 'UPD-002', 'is_current': 1})
            # 'id' is not in ALLOWED_UPDATE_COLUMNS
            result = update_record(record_id, {'id': 999})
            assert result is False

    def test_allowed_columns_whitelist(self):
        assert 'sku' in ALLOWED_UPDATE_COLUMNS
        assert 'unit_price' in ALLOWED_UPDATE_COLUMNS
        assert 'id' not in ALLOWED_UPDATE_COLUMNS
        assert 'created_at' not in ALLOWED_UPDATE_COLUMNS


class TestDeleteRecord:
    def test_soft_delete(self, temp_db):
        with patch('procurement.services.database.DATABASE_PATH', temp_db):
            record_id = insert_record({'sku': 'DEL-001', 'is_current': 1})
            delete_record(record_id)

            fetched = get_record_by_id(record_id)
            assert fetched['is_current'] == 0


class TestSaveApprovedRecords:
    def test_saves_to_both_tables(self, temp_db):
        with patch('procurement.services.database.DATABASE_PATH', temp_db):
            records = [
                {'sku': 'APR-001', 'unit_price': 100, 'quantity': 1, 'total_price': 100,
                 'distributor': 'D', 'item_description': 'Item'},
                {'sku': 'APR-002', 'unit_price': 200, 'quantity': 2, 'total_price': 400,
                 'distributor': 'D', 'item_description': 'Item 2'},
            ]
            ids = save_approved_records(records, source_file='test.pdf')
            assert len(ids) == 2

            # Check records table
            current = get_current_records()
            assert len(current) >= 2

            # Check historical_archive table
            conn = sqlite3.connect(str(temp_db))
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT COUNT(*) as cnt FROM historical_archive WHERE sku IN ('APR-001', 'APR-002')")
            count = cursor.fetchone()['cnt']
            conn.close()
            assert count == 2


class TestSearchHistoricalRecords:
    def test_search_by_sku(self, temp_db):
        with patch('procurement.services.database.DATABASE_PATH', temp_db):
            # Insert test data into historical_archive
            conn = sqlite3.connect(str(temp_db))
            conn.execute("INSERT INTO historical_archive (sku, unit_price, distributor) VALUES ('SRCH-001', 100, 'Dist')")
            conn.execute("INSERT INTO historical_archive (sku, unit_price, distributor) VALUES ('SRCH-002', 200, 'Dist')")
            conn.commit()
            conn.close()

            results = search_historical_records(sku='SRCH-001')
            assert len(results) >= 1
            assert results[0]['sku'] == 'SRCH-001'


class TestGetDashboardMetrics:
    def test_empty_db(self, temp_db):
        with patch('procurement.services.database.DATABASE_PATH', temp_db):
            metrics = get_dashboard_metrics()
            assert metrics['total_records'] == 0
            assert metrics['new_this_month'] == 0
            assert metrics['num_companies'] == 0
