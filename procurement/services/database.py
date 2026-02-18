"""
Database service for SQLite operations.
Handles all CRUD, historical archiving, search, and dashboard metrics.
"""
import sqlite3
from datetime import datetime
from pathlib import Path
from procurement.config.settings import DATABASE_PATH

ALLOWED_UPDATE_COLUMNS = {
    'sku', 'distributor', 'item_description', 'brand', 'quote_currency',
    'quantity', 'serial_no', 'start_date', 'end_date', 'unit_price',
    'total_price', 'eu_company', 'comments_notes', 'quotation_ref_no',
    'quotation_date', 'quotation_end_date', 'quotation_validity',
}

_RECORD_COLUMNS = [
    'sku', 'distributor', 'item_description', 'brand', 'quote_currency',
    'quantity', 'serial_no', 'start_date', 'end_date', 'unit_price',
    'total_price', 'eu_company', 'comments_notes', 'quotation_ref_no',
    'quotation_date', 'quotation_end_date', 'quotation_validity',
]


def get_db_connection():
    """Return a connection to the SQLite database."""
    path = Path(DATABASE_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Create all required tables if they don't exist."""
    conn = get_db_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT,
                distributor TEXT,
                item_description TEXT,
                brand TEXT,
                quote_currency TEXT,
                quantity REAL,
                serial_no TEXT,
                start_date TEXT,
                end_date TEXT,
                unit_price REAL,
                total_price REAL,
                eu_company TEXT,
                comments_notes TEXT,
                quotation_ref_no TEXT,
                quotation_date TEXT,
                quotation_end_date TEXT,
                quotation_validity TEXT,
                source_file TEXT,
                validation_status TEXT DEFAULT 'pending',
                validation_message TEXT,
                is_current INTEGER DEFAULT 1,
                user_modified INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS historical_archive (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT,
                distributor TEXT,
                item_description TEXT,
                brand TEXT,
                quote_currency TEXT,
                quantity REAL,
                serial_no TEXT,
                start_date TEXT,
                end_date TEXT,
                unit_price REAL,
                total_price REAL,
                eu_company TEXT,
                comments_notes TEXT,
                quotation_ref_no TEXT,
                quotation_date TEXT,
                quotation_end_date TEXT,
                quotation_validity TEXT,
                source_file TEXT,
                archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                archive_reason TEXT DEFAULT 'approved'
            );

            CREATE INDEX IF NOT EXISTS idx_hist_sku ON historical_archive(sku);
            CREATE INDEX IF NOT EXISTS idx_hist_distributor ON historical_archive(distributor);
            CREATE INDEX IF NOT EXISTS idx_hist_eu_company ON historical_archive(eu_company);
            CREATE INDEX IF NOT EXISTS idx_hist_archived_at ON historical_archive(archived_at);

            CREATE TABLE IF NOT EXISTS uploaded_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                upload_status TEXT DEFAULT 'pending',
                records_extracted INTEGER DEFAULT 0,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS change_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                field_name TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                changed_by TEXT DEFAULT 'user',
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
    finally:
        conn.close()


def insert_record(record: dict) -> int:
    """Insert a record and return its ID."""
    conn = get_db_connection()
    try:
        cols = [c for c in record if c != 'id']
        placeholders = ', '.join(['?'] * len(cols))
        col_names = ', '.join(cols)
        values = [record[c] for c in cols]
        cursor = conn.execute(
            f"INSERT INTO records ({col_names}) VALUES ({placeholders})",
            values,
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_record_by_id(record_id: int) -> dict | None:
    """Retrieve a single record by ID."""
    conn = get_db_connection()
    try:
        cursor = conn.execute("SELECT * FROM records WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_current_records() -> list[dict]:
    """Get all active (non-deleted) records."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM records WHERE is_current = 1 ORDER BY created_at DESC"
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def update_record(record_id: int, updates: dict) -> bool:
    """Update a record. Only allowed columns may be updated. Returns True on success."""
    filtered = {k: v for k, v in updates.items() if k in ALLOWED_UPDATE_COLUMNS}
    if not filtered:
        return False

    conn = get_db_connection()
    try:
        # Log changes
        existing = get_record_by_id(record_id)
        if not existing:
            return False

        for field, new_val in filtered.items():
            old_val = existing.get(field)
            if str(old_val) != str(new_val):
                conn.execute(
                    "INSERT INTO change_log (record_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?)",
                    (record_id, field, str(old_val), str(new_val)),
                )

        set_clause = ', '.join([f"{k} = ?" for k in filtered])
        values = list(filtered.values()) + [datetime.now().isoformat(), record_id]
        conn.execute(
            f"UPDATE records SET {set_clause}, updated_at = ?, user_modified = 1 WHERE id = ?",
            values,
        )
        conn.commit()
        return True
    finally:
        conn.close()


def delete_record(record_id: int):
    """Soft-delete a record by setting is_current = 0."""
    conn = get_db_connection()
    try:
        conn.execute(
            "UPDATE records SET is_current = 0, updated_at = ? WHERE id = ?",
            (datetime.now().isoformat(), record_id),
        )
        conn.commit()
    finally:
        conn.close()


def save_approved_records(records: list[dict], source_file: str = '') -> list[int]:
    """Save records to both active records table and historical archive."""
    conn = get_db_connection()
    ids = []
    try:
        for record in records:
            record_data = {c: record.get(c) for c in _RECORD_COLUMNS}
            record_data['source_file'] = source_file
            record_data['is_current'] = 1
            record_data['validation_status'] = record.get('validation_status', 'valid')

            # Insert into records
            cols = list(record_data.keys())
            placeholders = ', '.join(['?'] * len(cols))
            col_names = ', '.join(cols)
            values = [record_data[c] for c in cols]
            cursor = conn.execute(
                f"INSERT INTO records ({col_names}) VALUES ({placeholders})", values
            )
            ids.append(cursor.lastrowid)

            # Insert into historical_archive
            archive_data = {c: record.get(c) for c in _RECORD_COLUMNS}
            archive_data['source_file'] = source_file
            archive_data['archive_reason'] = 'approved'
            a_cols = list(archive_data.keys())
            a_placeholders = ', '.join(['?'] * len(a_cols))
            a_col_names = ', '.join(a_cols)
            a_values = [archive_data[c] for c in a_cols]
            conn.execute(
                f"INSERT INTO historical_archive ({a_col_names}) VALUES ({a_placeholders})",
                a_values,
            )

        conn.commit()
        return ids
    finally:
        conn.close()


def search_historical_records(
    sku: str = None,
    eu_company: str = None,
    distributor: str = None,
    date_from: str = None,
    date_to: str = None,
    query: str = None,
    limit: int = 500,
) -> list[dict]:
    """Search historical archive with optional filters."""
    conn = get_db_connection()
    try:
        sql = "SELECT * FROM historical_archive WHERE 1=1"
        params = []

        if sku:
            sql += " AND sku LIKE ?"
            params.append(f"%{sku}%")
        if eu_company:
            sql += " AND eu_company LIKE ?"
            params.append(f"%{eu_company}%")
        if distributor:
            sql += " AND distributor LIKE ?"
            params.append(f"%{distributor}%")
        if date_from:
            sql += " AND archived_at >= ?"
            params.append(date_from)
        if date_to:
            sql += " AND archived_at <= ?"
            params.append(date_to)
        if query:
            sql += " AND (sku LIKE ? OR item_description LIKE ? OR distributor LIKE ?)"
            params.extend([f"%{query}%"] * 3)

        sql += " ORDER BY archived_at DESC LIMIT ?"
        params.append(limit)

        cursor = conn.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def get_historical_stats(
    sku: str = None,
    eu_company: str = None,
) -> dict:
    """Get aggregate statistics from historical archive."""
    conn = get_db_connection()
    try:
        sql = """
            SELECT
                COUNT(*) as total_records,
                COUNT(DISTINCT sku) as unique_skus,
                COUNT(DISTINCT distributor) as unique_distributors,
                AVG(unit_price) as avg_unit_price,
                MIN(unit_price) as min_unit_price,
                MAX(unit_price) as max_unit_price
            FROM historical_archive WHERE 1=1
        """
        params = []
        if sku:
            sql += " AND sku LIKE ?"
            params.append(f"%{sku}%")
        if eu_company:
            sql += " AND eu_company LIKE ?"
            params.append(f"%{eu_company}%")

        cursor = conn.execute(sql, params)
        row = cursor.fetchone()
        return dict(row) if row else {}
    finally:
        conn.close()


def get_dashboard_metrics() -> dict:
    """Get aggregate dashboard metrics."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT COUNT(*) as cnt FROM records WHERE is_current = 1"
        )
        total_records = cursor.fetchone()['cnt']

        new_this_month = get_records_added_this_month()

        cursor = conn.execute(
            "SELECT COUNT(DISTINCT eu_company) as cnt FROM records WHERE is_current = 1 AND eu_company IS NOT NULL"
        )
        num_companies = cursor.fetchone()['cnt']

        cursor = conn.execute(
            "SELECT COUNT(DISTINCT sku) as cnt FROM records WHERE is_current = 1 AND sku IS NOT NULL"
        )
        num_skus = cursor.fetchone()['cnt']

        cursor = conn.execute(
            "SELECT * FROM uploaded_files ORDER BY uploaded_at DESC LIMIT 10"
        )
        recent_uploads = [dict(row) for row in cursor.fetchall()]

        cursor = conn.execute("""
            SELECT
                SUM(CASE WHEN validation_status = 'valid' THEN 1 ELSE 0 END) as valid,
                SUM(CASE WHEN validation_status = 'warning' THEN 1 ELSE 0 END) as warning,
                SUM(CASE WHEN validation_status = 'error' THEN 1 ELSE 0 END) as error
            FROM records WHERE is_current = 1
        """)
        vs = cursor.fetchone()
        validation_summary = {
            'valid': vs['valid'] or 0,
            'warning': vs['warning'] or 0,
            'error': vs['error'] or 0,
        }

        return {
            'total_records': total_records,
            'new_this_month': new_this_month,
            'num_companies': num_companies,
            'num_skus': num_skus,
            'recent_uploads': recent_uploads,
            'validation_summary': validation_summary,
        }
    finally:
        conn.close()


def get_records_added_this_month() -> int:
    """Count records created in the current month."""
    conn = get_db_connection()
    try:
        now = datetime.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        cursor = conn.execute(
            "SELECT COUNT(*) as cnt FROM records WHERE is_current = 1 AND created_at >= ?",
            (start_of_month.isoformat(),),
        )
        return cursor.fetchone()['cnt']
    finally:
        conn.close()


def get_price_trend_by_sku(sku: str) -> dict:
    """Get monthly price trend data for a specific SKU."""
    conn = get_db_connection()
    try:
        cursor = conn.execute("""
            SELECT
                strftime('%Y-%m', archived_at) as month,
                AVG(unit_price) as avg_price,
                MIN(unit_price) as min_price,
                MAX(unit_price) as max_price,
                COUNT(*) as record_count
            FROM historical_archive
            WHERE sku = ? AND unit_price IS NOT NULL
            GROUP BY strftime('%Y-%m', archived_at)
            ORDER BY month
        """, (sku,))
        data_points = [dict(row) for row in cursor.fetchall()]
        return {'sku': sku, 'data_points': data_points}
    finally:
        conn.close()


def get_distinct_eu_companies() -> list[str]:
    """Get all distinct EU company names from records and historical archive."""
    conn = get_db_connection()
    try:
        cursor = conn.execute("""
            SELECT DISTINCT eu_company FROM (
                SELECT eu_company FROM records WHERE eu_company IS NOT NULL AND eu_company != ''
                UNION
                SELECT eu_company FROM historical_archive WHERE eu_company IS NOT NULL AND eu_company != ''
            ) ORDER BY eu_company
        """)
        return [row['eu_company'] for row in cursor.fetchall()]
    finally:
        conn.close()


def get_distinct_distributors() -> list[str]:
    """Get all distinct distributor names."""
    conn = get_db_connection()
    try:
        cursor = conn.execute("""
            SELECT DISTINCT distributor FROM (
                SELECT distributor FROM records WHERE distributor IS NOT NULL AND distributor != ''
                UNION
                SELECT distributor FROM historical_archive WHERE distributor IS NOT NULL AND distributor != ''
            ) ORDER BY distributor
        """)
        return [row['distributor'] for row in cursor.fetchall()]
    finally:
        conn.close()


def get_historical_price_summary(sku: str, eu_company: str = None) -> dict | None:
    """Get price statistics for a specific SKU, optionally filtered by company."""
    conn = get_db_connection()
    try:
        sql = """
            SELECT
                AVG(unit_price) as avg_price,
                MIN(unit_price) as min_price,
                MAX(unit_price) as max_price,
                COUNT(*) as record_count
            FROM historical_archive
            WHERE sku = ? AND unit_price IS NOT NULL
        """
        params = [sku]
        if eu_company:
            sql += " AND eu_company = ?"
            params.append(eu_company)

        cursor = conn.execute(sql, params)
        row = cursor.fetchone()
        if row and row['record_count'] > 0:
            return dict(row)
        return None
    finally:
        conn.close()


def insert_uploaded_file(filename: str, file_type: str, file_size: int) -> int:
    """Track an uploaded file. Returns the file ID."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO uploaded_files (filename, original_name, file_type, file_size) VALUES (?, ?, ?, ?)",
            (filename, filename, file_type, file_size),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def update_uploaded_file(file_id: int, status: str, records_extracted: int = 0):
    """Update the processing status of an uploaded file."""
    conn = get_db_connection()
    try:
        conn.execute(
            "UPDATE uploaded_files SET upload_status = ?, records_extracted = ? WHERE id = ?",
            (status, records_extracted, file_id),
        )
        conn.commit()
    finally:
        conn.close()


def get_all_skus() -> list[str]:
    """Get all distinct SKUs from historical archive."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT DISTINCT sku FROM historical_archive WHERE sku IS NOT NULL AND sku != '' ORDER BY sku"
        )
        return [row['sku'] for row in cursor.fetchall()]
    finally:
        conn.close()
