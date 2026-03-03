"""
Database service for SQLite operations.
Handles all CRUD, historical archiving, search, and dashboard metrics.
"""
import random
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
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

            CREATE TABLE IF NOT EXISTS catalog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT UNIQUE NOT NULL,
                item_description TEXT,
                brand TEXT,
                base_price REAL,
                min_price REAL,
                max_price REAL,
                currency TEXT DEFAULT 'USD',
                category TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_deleted INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_catalog_sku ON catalog(sku);
            CREATE INDEX IF NOT EXISTS idx_catalog_brand ON catalog(brand);
            CREATE INDEX IF NOT EXISTS idx_catalog_category ON catalog(category);

            CREATE TABLE IF NOT EXISTS record_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                record_id INTEGER NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_comments_record ON record_comments(record_id);

            CREATE TABLE IF NOT EXISTS reference_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                collection_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS catalog_pdf_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT NOT NULL,
                found INTEGER DEFAULT 0,
                base_price REAL,
                item_description TEXT,
                brand TEXT,
                raw_response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_pdf_cache_sku ON catalog_pdf_cache(sku);
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


def get_record_by_id(record_id: int) -> "dict | None":
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
    # Clean up any drafts for this source file first
    if source_file:
        delete_draft_records_by_file(source_file)

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

        # Top distributor
        cursor = conn.execute(
            "SELECT distributor, COUNT(*) as cnt FROM records WHERE is_current=1 AND distributor IS NOT NULL GROUP BY distributor ORDER BY cnt DESC LIMIT 1"
        )
        top_dist_row = cursor.fetchone()
        top_distributor = top_dist_row['distributor'] if top_dist_row else None
        top_distributor_count = top_dist_row['cnt'] if top_dist_row else 0

        # Average unit price
        cursor = conn.execute(
            "SELECT ROUND(AVG(unit_price), 2) as avg FROM records WHERE is_current=1 AND unit_price IS NOT NULL"
        )
        avg_row = cursor.fetchone()
        avg_unit_price = avg_row['avg'] if avg_row else None

        # Most quoted SKU
        cursor = conn.execute(
            "SELECT sku, COUNT(*) as cnt FROM records WHERE is_current=1 AND sku IS NOT NULL GROUP BY sku ORDER BY cnt DESC LIMIT 1"
        )
        top_sku_row = cursor.fetchone()
        most_quoted_sku = top_sku_row['sku'] if top_sku_row else None
        most_quoted_sku_count = top_sku_row['cnt'] if top_sku_row else 0

        return {
            'total_records': total_records,
            'new_this_month': new_this_month,
            'num_companies': num_companies,
            'num_skus': num_skus,
            'recent_uploads': recent_uploads,
            'validation_summary': validation_summary,
            'top_distributor': top_distributor,
            'top_distributor_count': top_distributor_count,
            'avg_unit_price': avg_unit_price,
            'most_quoted_sku': most_quoted_sku,
            'most_quoted_sku_count': most_quoted_sku_count,
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


def get_historical_price_summary(sku: str, eu_company: str = None) -> "dict | None":
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


def insert_uploaded_file(filename: str, file_type: str, file_size: int, disk_filename: str = '') -> int:
    """Track an uploaded file. Returns the file ID."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO uploaded_files (filename, original_name, file_type, file_size) VALUES (?, ?, ?, ?)",
            (disk_filename or filename, filename, file_type, file_size),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def update_uploaded_file(file_id: int, status: Optional[str] = None, records_extracted: Optional[int] = None):
    """Update the processing status and/or record count of an uploaded file."""
    sets = []
    params: list = []
    if status is not None:
        sets.append("upload_status = ?")
        params.append(status)
    if records_extracted is not None:
        sets.append("records_extracted = ?")
        params.append(records_extracted)
    if not sets:
        return
    params.append(file_id)
    conn = get_db_connection()
    try:
        conn.execute(f"UPDATE uploaded_files SET {', '.join(sets)} WHERE id = ?", params)
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


def generate_historical_for_skus(records: list[dict]):
    """Generate synthetic historical pricing data for extracted SKUs.

    For each unique SKU in the records, checks if sufficient historical data
    exists. If fewer than 5 records, generates 12 months of synthetic entries
    with slight price/quantity variance around the extracted values.
    """
    # Group records by SKU, keeping first occurrence for reference data
    sku_map: dict[str, dict] = {}
    for rec in records:
        sku = rec.get('sku')
        if sku and sku not in sku_map:
            sku_map[sku] = rec

    if not sku_map:
        return

    conn = get_db_connection()
    try:
        now = datetime.now()
        for sku, ref in sku_map.items():
            # Check existing count
            cursor = conn.execute(
                "SELECT COUNT(*) as cnt FROM historical_archive WHERE sku = ?",
                (sku,),
            )
            count = cursor.fetchone()['cnt']
            if count >= 5:
                continue

            base_price = ref.get('unit_price') or 0
            base_qty = ref.get('quantity') or 1
            distributor = ref.get('distributor', '')
            eu_company = ref.get('eu_company', '')
            description = ref.get('item_description', '')
            brand = ref.get('brand', '')
            currency = ref.get('quote_currency', 'USD')

            if base_price <= 0:
                continue

            # Generate 12 monthly entries going back from current month
            for month_offset in range(1, 13):
                entry_date = now - timedelta(days=30 * month_offset)
                date_str = entry_date.strftime('%Y-%m-%d')

                # Price: base ± 10% with slight upward drift for older entries
                drift = 1.0 - (month_offset * 0.005)  # older prices slightly lower
                variance = random.uniform(-0.10, 0.10)
                price = round(base_price * drift * (1 + variance), 2)

                # Quantity: base ± 30% variance
                qty_variance = random.uniform(-0.30, 0.30)
                qty = max(1, round(base_qty * (1 + qty_variance)))

                total = round(price * qty, 2)

                conn.execute(
                    """INSERT INTO historical_archive
                       (sku, distributor, item_description, brand, quote_currency,
                        quantity, unit_price, total_price, eu_company,
                        archived_at, archive_reason, start_date)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (sku, distributor, description, brand, currency,
                     qty, price, total, eu_company,
                     date_str, 'synthetic_historical', date_str),
                )

        conn.commit()
    finally:
        conn.close()


def get_historical_price_summaries_batch(skus: list[str]) -> dict[str, dict]:
    """Get price and quantity statistics for multiple SKUs in one query.

    Returns a dict keyed by SKU with avg_price, min_price, max_price,
    avg_quantity, and record_count for each.
    """
    if not skus:
        return {}

    conn = get_db_connection()
    try:
        placeholders = ', '.join(['?'] * len(skus))
        cursor = conn.execute(
            f"""SELECT
                    sku,
                    AVG(unit_price) as avg_price,
                    MIN(unit_price) as min_price,
                    MAX(unit_price) as max_price,
                    AVG(quantity) as avg_quantity,
                    COUNT(*) as record_count
                FROM historical_archive
                WHERE sku IN ({placeholders}) AND unit_price IS NOT NULL
                GROUP BY sku""",
            skus,
        )
        result = {}
        for row in cursor.fetchall():
            result[row['sku']] = {
                'avg_price': round(row['avg_price'], 2) if row['avg_price'] else 0,
                'min_price': round(row['min_price'], 2) if row['min_price'] else 0,
                'max_price': round(row['max_price'], 2) if row['max_price'] else 0,
                'avg_quantity': round(row['avg_quantity'], 1) if row['avg_quantity'] else 0,
                'record_count': row['record_count'],
            }
        return result
    finally:
        conn.close()


def get_all_known_skus() -> list[str]:
    """Get all SKUs from historical archive (for fuzzy matching)."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT DISTINCT sku FROM historical_archive WHERE sku IS NOT NULL AND sku != '' ORDER BY sku"
        )
        return [row['sku'] for row in cursor.fetchall()]
    finally:
        conn.close()


def get_catalog_skus() -> list[str]:
    """Get all SKUs from the catalog."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT sku FROM catalog WHERE is_deleted = 0 ORDER BY sku"
        )
        return [row['sku'] for row in cursor.fetchall()]
    finally:
        conn.close()


def get_catalog_entry_by_sku(sku: str) -> "dict | None":
    """Get a single catalog entry by SKU."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM catalog WHERE sku = ? AND is_deleted = 0", (sku,)
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_catalog_entries_batch(skus: list[str]) -> dict[str, dict]:
    """Get catalog entries for multiple SKUs. Returns dict keyed by SKU."""
    if not skus:
        return {}

    conn = get_db_connection()
    try:
        placeholders = ', '.join(['?'] * len(skus))
        cursor = conn.execute(
            f"SELECT * FROM catalog WHERE sku IN ({placeholders}) AND is_deleted = 0",
            skus,
        )
        result = {}
        for row in cursor.fetchall():
            result[row['sku']] = dict(row)
        return result
    finally:
        conn.close()


def get_catalog_entries(
    search: str = None,
    brand: str = None,
    category: str = None,
    limit: int = 500,
) -> list[dict]:
    """Search and filter catalog entries."""
    conn = get_db_connection()
    try:
        sql = "SELECT * FROM catalog WHERE is_deleted = 0"
        params = []

        if search:
            sql += " AND (sku LIKE ? OR item_description LIKE ?)"
            params.extend([f"%{search}%", f"%{search}%"])
        if brand:
            sql += " AND brand LIKE ?"
            params.append(f"%{brand}%")
        if category:
            sql += " AND category LIKE ?"
            params.append(f"%{category}%")

        sql += " ORDER BY sku LIMIT ?"
        params.append(limit)

        cursor = conn.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def insert_catalog_entries(entries: list[dict]) -> int:
    """Insert catalog entries. Returns count of inserted records."""
    if not entries:
        return 0

    conn = get_db_connection()
    try:
        inserted = 0
        for entry in entries:
            # Extract relevant fields
            sku = entry.get('sku', '').strip().upper()
            if not sku:
                continue

            # Check if exists
            cursor = conn.execute("SELECT id FROM catalog WHERE sku = ?", (sku,))
            existing = cursor.fetchone()

            if existing:
                # Update existing
                updates = {
                    'item_description': entry.get('item_description'),
                    'brand': entry.get('brand'),
                    'base_price': entry.get('base_price'),
                    'min_price': entry.get('min_price'),
                    'max_price': entry.get('max_price'),
                    'currency': entry.get('currency', 'USD'),
                    'category': entry.get('category'),
                    'is_deleted': 0,
                    'updated_at': datetime.now().isoformat(),
                }
                set_clause = ', '.join([f"{k} = ?" for k in updates])
                values = list(updates.values()) + [sku]
                conn.execute(
                    f"UPDATE catalog SET {set_clause} WHERE sku = ?", values
                )
                inserted += 1
            else:
                # Insert new
                conn.execute(
                    """INSERT INTO catalog
                       (sku, item_description, brand, base_price, min_price, max_price, currency, category)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (sku,
                     entry.get('item_description'),
                     entry.get('brand'),
                     entry.get('base_price'),
                     entry.get('min_price'),
                     entry.get('max_price'),
                     entry.get('currency', 'USD'),
                     entry.get('category')),
                )
                inserted += 1

        conn.commit()
        return inserted
    finally:
        conn.close()


def delete_catalog_entry(entry_id: int) -> bool:
    """Soft-delete a catalog entry."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT id FROM catalog WHERE id = ?", (entry_id,)
        )
        if not cursor.fetchone():
            return False

        conn.execute(
            "UPDATE catalog SET is_deleted = 1, updated_at = ? WHERE id = ?",
            (datetime.now().isoformat(), entry_id),
        )
        conn.commit()
        return True
    finally:
        conn.close()


def get_catalog_stats() -> dict:
    """Get catalog statistics."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT COUNT(*) as total FROM catalog WHERE is_deleted = 0"
        )
        total = cursor.fetchone()['total']

        cursor = conn.execute(
            "SELECT COUNT(DISTINCT brand) as brands FROM catalog WHERE is_deleted = 0 AND brand IS NOT NULL"
        )
        brands = cursor.fetchone()['brands'] or 0

        cursor = conn.execute(
            "SELECT COUNT(DISTINCT category) as categories FROM catalog WHERE is_deleted = 0 AND category IS NOT NULL"
        )
        categories = cursor.fetchone()['categories'] or 0

        return {
            'total_entries': total,
            'total_brands': brands,
            'total_categories': categories,
        }
    finally:
        conn.close()


def get_comments_for_record(record_id: int) -> list[dict]:
    """Get all comments for a record."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT id, record_id, text, created_at FROM record_comments WHERE record_id = ? ORDER BY created_at DESC",
            (record_id,)
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def add_comment(record_id: int, text: str) -> int:
    """Add a comment to a record. Returns the new comment ID."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO record_comments (record_id, text) VALUES (?, ?)",
            (record_id, text)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def delete_comment(comment_id: int) -> bool:
    """Delete a comment by ID."""
    conn = get_db_connection()
    try:
        cursor = conn.execute("SELECT id FROM record_comments WHERE id = ?", (comment_id,))
        if not cursor.fetchone():
            return False
        conn.execute("DELETE FROM record_comments WHERE id = ?", (comment_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def batch_delete_records(ids: list[int]) -> int:
    """Delete multiple records by ID. Returns count of records deleted."""
    count = 0
    for record_id in ids:
        delete_record(record_id)
        count += 1
    return count


def save_draft_records(records: list[dict], file_id: int, source_file: str = '') -> list[int]:
    """Save extracted records as drafts (is_current=0) linked to an uploaded file."""
    conn = get_db_connection()
    ids = []
    try:
        for record in records:
            record_data = {c: record.get(c) for c in _RECORD_COLUMNS}
            record_data['source_file'] = source_file
            record_data['is_current'] = 0  # draft — not yet approved
            record_data['validation_status'] = record.get('validation_status', 'pending')
            record_data['validation_message'] = record.get('validation_message', '')

            cols = list(record_data.keys())
            placeholders = ', '.join(['?'] * len(cols))
            col_names = ', '.join(cols)
            values = [record_data[c] for c in cols]
            cursor = conn.execute(
                f"INSERT INTO records ({col_names}) VALUES ({placeholders})", values
            )
            ids.append(cursor.lastrowid)
        conn.commit()
        return ids
    finally:
        conn.close()


def get_draft_records_by_file(source_file: str) -> list[dict]:
    """Get draft records (is_current=0) for a given source file."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM records WHERE is_current = 0 AND source_file = ? ORDER BY id",
            (source_file,),
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def delete_draft_records_by_file(source_file: str) -> int:
    """Hard-delete draft records for a source file (used when approving or re-uploading)."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "DELETE FROM records WHERE is_current = 0 AND source_file = ?",
            (source_file,),
        )
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()


def replace_draft_records(records: list[dict], source_file: str) -> list[int]:
    """Delete existing drafts for a source file and re-insert updated records."""
    delete_draft_records_by_file(source_file)
    conn = get_db_connection()
    ids = []
    try:
        for record in records:
            record_data = {c: record.get(c) for c in _RECORD_COLUMNS}
            record_data['source_file'] = source_file
            record_data['is_current'] = 0
            record_data['validation_status'] = record.get('validation_status', 'pending')
            record_data['validation_message'] = record.get('validation_message', '')

            cols = list(record_data.keys())
            placeholders = ', '.join(['?'] * len(cols))
            col_names = ', '.join(cols)
            values = [record_data[c] for c in cols]
            cursor = conn.execute(
                f"INSERT INTO records ({col_names}) VALUES ({placeholders})", values
            )
            ids.append(cursor.lastrowid)
        conn.commit()
        return ids
    finally:
        conn.close()


def get_uploaded_files(limit: int = 50) -> list[dict]:
    """Get all uploaded files ordered by most recent."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM uploaded_files ORDER BY uploaded_at DESC LIMIT ?",
            (limit,),
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def delete_uploaded_file(file_id: int) -> bool:
    """Delete an uploaded file record and its associated draft records."""
    conn = get_db_connection()
    try:
        # Get the original name to clean up drafts
        cursor = conn.execute("SELECT original_name FROM uploaded_files WHERE id = ?", (file_id,))
        row = cursor.fetchone()
        if not row:
            return False
        original_name = row['original_name']

        # Delete drafts linked to this file
        conn.execute(
            "DELETE FROM records WHERE is_current = 0 AND source_file = ?",
            (original_name,),
        )
        # Delete the uploaded file record
        conn.execute("DELETE FROM uploaded_files WHERE id = ?", (file_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def save_reference_document(filename: str, original_name: str, collection_id: str) -> int:
    """Save a reference document record. Returns the new ID."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO reference_documents (filename, original_name, collection_id) VALUES (?, ?, ?)",
            (filename, original_name, collection_id),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_reference_documents() -> list[dict]:
    """Get all reference documents."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM reference_documents ORDER BY created_at DESC"
        )
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()


def delete_reference_document(doc_id: int) -> "dict | None":
    """Delete a reference document by ID. Returns the row (for collection cleanup) or None."""
    conn = get_db_connection()
    try:
        cursor = conn.execute("SELECT * FROM reference_documents WHERE id = ?", (doc_id,))
        row = cursor.fetchone()
        if not row:
            return None
        doc = dict(row)
        conn.execute("DELETE FROM reference_documents WHERE id = ?", (doc_id,))
        conn.commit()
        return doc
    finally:
        conn.close()


def get_pdf_cache_entry(sku: str) -> "dict | None":
    """Get a cached PDF catalog lookup result for a SKU."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "SELECT * FROM catalog_pdf_cache WHERE sku = ? ORDER BY created_at DESC LIMIT 1",
            (sku,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def save_pdf_cache_entry(sku: str, found: bool, base_price: float = None,
                         item_description: str = None, brand: str = None,
                         raw_response: str = None) -> int:
    """Cache a PDF catalog lookup result. Returns the new ID."""
    conn = get_db_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO catalog_pdf_cache (sku, found, base_price, item_description, brand, raw_response) VALUES (?, ?, ?, ?, ?, ?)",
            (sku, 1 if found else 0, base_price, item_description, brand, raw_response),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def batch_adjust_catalog_prices(pct: float, brand: str = None, category: str = None) -> int:
    """Batch adjust catalog prices by percentage. Returns count of records updated."""
    conn = get_db_connection()
    try:
        sql = "UPDATE catalog SET base_price = base_price * (1 + ?/100), updated_at = ? WHERE is_deleted = 0"
        params = [pct, datetime.now().isoformat()]

        if brand:
            sql += " AND brand LIKE ?"
            params.insert(2, f"%{brand}%")
        if category:
            sql += " AND category LIKE ?"
            params.insert(2 if not brand else 3, f"%{category}%")

        cursor = conn.execute(sql, params)
        conn.commit()
        return cursor.rowcount
    finally:
        conn.close()
