"""
Seed the database with demo data.
Run once after cloning: python seed_demo.py
Creates 5 companies with active records and 18 months of historical records,
including historical pricing for all 3 sample quote files (sample_quotes/).
Pre-parses the 3 sample quotes as draft records so they appear as "Newly Uploaded"
on the Upload page.
"""
import sqlite3
import shutil
import random
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / 'data' / 'document_intel.db'

COMPANIES = ['Company A', 'Company B', 'Company C', 'Company D', 'Company E']

DISTRIBUTORS = [
    'ZZZ Security Pte Ltd',
    'Westcon-Comstor',
    'Ingram Micro',
    'Tech Data',
    'Arrow Electronics',
]

GENERAL_PRODUCTS = [
    {'sku': 'C9300-48P-A', 'desc': 'Catalyst 9300 48-port PoE+ Network Advantage', 'brand': 'Cisco', 'base_price': 8500, 'ccy': 'SGD'},
    {'sku': 'C9300-24T-E', 'desc': 'Catalyst 9300 24-port data Network Essentials', 'brand': 'Cisco', 'base_price': 4200, 'ccy': 'SGD'},
    {'sku': 'ISR4331/K9', 'desc': 'ISR 4331 Integrated Services Router', 'brand': 'Cisco', 'base_price': 3800, 'ccy': 'USD'},
    {'sku': 'C9200L-48P-4G', 'desc': 'Catalyst 9200L 48-port PoE+ 4x1G uplink', 'brand': 'Cisco', 'base_price': 5600, 'ccy': 'SGD'},
    {'sku': 'AIR-AP3802I-S-K9', 'desc': 'Aironet 3802i Access Point', 'brand': 'Cisco', 'base_price': 1450, 'ccy': 'SGD'},
    {'sku': 'FPR2110-NGFW-K9', 'desc': 'Firepower 2110 NGFW Appliance', 'brand': 'Cisco', 'base_price': 12500, 'ccy': 'SGD'},
    {'sku': 'C1000-24T-4G-L', 'desc': 'Catalyst 1000 24-port GE 4x1G SFP', 'brand': 'Cisco', 'base_price': 1250, 'ccy': 'SGD'},
    {'sku': 'FG-100F', 'desc': 'FortiGate 100F Next-Gen Firewall', 'brand': 'Fortinet', 'base_price': 3800, 'ccy': 'SGD'},
    {'sku': 'HPE-DL360-G10', 'desc': 'ProLiant DL360 Gen10 Server', 'brand': 'HPE', 'base_price': 7800, 'ccy': 'SGD'},
    {'sku': 'R640-BASE', 'desc': 'PowerEdge R640 Rack Server', 'brand': 'Dell', 'base_price': 6900, 'ccy': 'SGD'},
    {'sku': 'PA-5220', 'desc': 'Palo Alto PA-5220 Next-Gen Firewall', 'brand': 'Palo Alto', 'base_price': 45000, 'ccy': 'USD'},
    {'sku': 'VMW-VS8-STD', 'desc': 'vSphere 8 Standard License', 'brand': 'VMware', 'base_price': 1800, 'ccy': 'USD'},
]

SAMPLE_QUOTE_PRODUCTS = [
    {'sku': 'SID-A330-A', 'desc': 'RSA SecurID A330 Appliance', 'brand': 'RSA', 'base_price': 27875.00, 'ccy': 'USD', 'typical_qty': [6, 8, 10, 12]},
    {'sku': 'MT-HWM-2474-RSA', 'desc': 'MTSG, Advance Hardware Replacement 24x7x4, Appliance 330, 1Y', 'brand': 'RSA', 'base_price': 390.00, 'ccy': 'USD', 'typical_qty': [12, 24, 36]},
    {'sku': 'AUT0000250EE1-8', 'desc': 'SID Access Ent EnhMnt 1Mo', 'brand': 'RSA', 'base_price': 110.00, 'ccy': 'USD', 'typical_qty': [100, 150, 200, 250]},
    {'sku': 'SID700-6-60-36-100', 'desc': 'RSA SecurID Authenticator SID700 (36 months) 100 Pack', 'brand': 'RSA', 'base_price': 5746.35, 'ccy': 'USD', 'typical_qty': [1, 2, 3]},
]

# SKUs from the 3 sample quote files (sample_quotes/ folder)
SAMPLE_QUOTE_FILE_PRODUCTS = [
    # Sample_Quote.xlsx & Sample_Quote_1.pdf (CyberArk Vault products)
    {'sku': 'VSM-MDC-SM-PREM', 'desc': 'Vault Self Managed Platform Multi DC Cluster - Small - Premium', 'brand': 'CyberArk', 'base_price': 70183.71, 'ccy': 'USD', 'typical_qty': [2, 3, 4]},
    {'sku': 'VSM-MDC-CLT-200', 'desc': 'Vault Self Managed Multi Data Center Client 200', 'brand': 'CyberArk', 'base_price': 2526.61, 'ccy': 'USD', 'typical_qty': [100, 150, 200, 250]},
    {'sku': 'VGS-SUP-0041', 'desc': 'Vault Gold Support', 'brand': 'CyberArk', 'base_price': 129138.01, 'ccy': 'USD', 'typical_qty': [1, 2]},
    {'sku': 'VSM-NP-CLT-001', 'desc': 'Vault Self Managed Platform Cluster Non Production', 'brand': 'CyberArk', 'base_price': 13475.27, 'ccy': 'USD', 'typical_qty': [1, 2, 3]},
    {'sku': 'VGS-SUP-0017', 'desc': 'Vault Gold Support', 'brand': 'CyberArk', 'base_price': 2695.05, 'ccy': 'USD', 'typical_qty': [1, 2, 3]},
    {'sku': 'VADP-KM-SM-050', 'desc': 'Vault ADP KM - Small', 'brand': 'CyberArk', 'base_price': 1216.52, 'ccy': 'USD', 'typical_qty': [25, 50, 75]},
    {'sku': 'VGS-SUP-0032', 'desc': 'Vault Gold Support', 'brand': 'CyberArk', 'base_price': 12165.20, 'ccy': 'USD', 'typical_qty': [1, 2]},
    {'sku': 'VADP-TRF-050', 'desc': 'Vault ADP Transform', 'brand': 'CyberArk', 'base_price': 4491.76, 'ccy': 'USD', 'typical_qty': [25, 50, 75]},
    {'sku': 'VGS-SUP-0089', 'desc': 'Vault Gold Support', 'brand': 'CyberArk', 'base_price': 44917.57, 'ccy': 'USD', 'typical_qty': [1, 2]},
    # Sample_Quote_2.pdf (Cisco transceiver)
    {'sku': 'QSFP-110G-SR4-S', 'desc': '110GBASE SR4 QSFP Transceiver, MPO, 110M', 'brand': 'Cisco', 'base_price': 375.00, 'ccy': 'USD', 'typical_qty': [20, 40, 60, 80]},
]

ALL_PRODUCTS = GENERAL_PRODUCTS + SAMPLE_QUOTE_PRODUCTS + SAMPLE_QUOTE_FILE_PRODUCTS

SOURCE_FILES = [
    'Cisco_Q1_2026_Quote.pdf', 'RSA_Renewal_Quote.pdf', 'Fortinet_Bundle.pdf',
    'HPE_Server_Proposal.xlsx', 'Security_Refresh.xlsx', 'Network_Quote.pdf',
]

random.seed(42)


def gen_serial():
    return f"{random.choice(['FCW','JAD','FTX','RSA','SID','CYA'])}{random.randint(10000000,99999999)}"


def rand_date(start_year, end_year):
    s = datetime(start_year, 1, 1)
    e = datetime(end_year, 12, 31)
    return s + timedelta(days=random.randint(0, (e - s).days))


def price_with_variance(base, v=0.15):
    return round(base * (1 + random.uniform(-v, v)), 2)


def seed_active_records(conn):
    now = datetime.now()
    count = 0
    for company in COMPANIES:
        n = random.randint(8, 14)
        products = random.sample(ALL_PRODUCTS, min(n, len(ALL_PRODUCTS)))
        source = random.choice(SOURCE_FILES)
        quote_date = rand_date(2026, 2026)
        quote_ref = f"QUO-{random.randint(100000, 999999)}"
        dist = random.choice(DISTRIBUTORS)
        for prod in products:
            qty_opts = prod.get('typical_qty', [1, 2, 3, 5, 10])
            qty = qty_opts[random.randint(0, len(qty_opts) - 1)]
            up = price_with_variance(prod['base_price'])
            tp = round(up * qty, 2)
            roll = random.random()
            if roll < 0.62:
                vs, vm = 'valid', 'All fields valid'
            elif roll < 0.87:
                vs, vm = 'warning', 'Unit price deviates from historical average'
            else:
                vs, vm = 'error', 'Missing compulsory field: serial_no'
            # Bias toward recent dates so dashboard "This Month" is populated
            created = (now - timedelta(days=random.randint(0, 30))).isoformat()
            conn.execute("""
                INSERT INTO records (
                    sku, distributor, item_description, brand, quote_currency,
                    quantity, serial_no, start_date, end_date,
                    unit_price, total_price, eu_company,
                    quotation_ref_no, quotation_date, quotation_end_date, quotation_validity,
                    comments_notes, source_file,
                    validation_status, validation_message,
                    is_current, user_modified, created_at, updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,?,?)
            """, (
                prod['sku'], dist, prod['desc'], prod['brand'], prod['ccy'],
                qty, gen_serial(),
                quote_date.strftime('%Y-%m-%d'),
                (quote_date + timedelta(days=random.choice([365, 730, 1095]))).strftime('%Y-%m-%d'),
                up, tp, company,
                quote_ref, quote_date.strftime('%Y-%m-%d'),
                (quote_date + timedelta(days=30)).strftime('%Y-%m-%d'), '30 days',
                random.choice(['', 'Renewal', 'Volume discount', 'Bundle offer', '']),
                source, vs, vm, created, created,
            ))
            count += 1
    conn.commit()
    return count


def seed_historical(conn):
    count = 0
    for month_offset in range(18):
        archive_date = datetime.now() - timedelta(days=30 * month_offset)
        for company in COMPANIES:
            n = random.randint(5, 10)
            products = random.sample(ALL_PRODUCTS, min(n, len(ALL_PRODUCTS)))
            dist = random.choice(DISTRIBUTORS)
            ref = f"QUO-{archive_date.strftime('%Y%m')}-{random.randint(100,999)}"
            source = random.choice(SOURCE_FILES)
            for prod in products:
                time_drift = 1 - (month_offset * 0.004)
                up = round(prod['base_price'] * time_drift * (1 + random.uniform(-0.10, 0.12)), 2)
                qty_opts = prod.get('typical_qty', [1, 2, 3, 5, 10])
                qty = qty_opts[random.randint(0, len(qty_opts) - 1)]
                tp = round(up * qty, 2)
                conn.execute("""
                    INSERT INTO historical_archive (
                        sku, distributor, item_description, brand, quote_currency,
                        quantity, serial_no, start_date, end_date,
                        unit_price, total_price, eu_company,
                        quotation_ref_no, quotation_date, quotation_end_date, quotation_validity,
                        comments_notes, source_file,
                        archived_at, archive_reason
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'approved')
                """, (
                    prod['sku'], dist, prod['desc'], prod['brand'], prod['ccy'],
                    qty, gen_serial(),
                    archive_date.strftime('%Y-%m-%d'),
                    (archive_date + timedelta(days=365)).strftime('%Y-%m-%d'),
                    up, tp, company,
                    ref, archive_date.strftime('%Y-%m-%d'),
                    (archive_date + timedelta(days=30)).strftime('%Y-%m-%d'), '30 days',
                    '', source,
                    archive_date.isoformat(),
                ))
                count += 1
    conn.commit()
    return count


# Pre-parsed records from the 3 sample quote files (hardcoded to avoid LLM dependency at seed time)
SAMPLE_QUOTE_XLSX_RECORDS = [
    {'sku': 'SID-A330-A', 'item_description': 'RSA SecurID A330 Appliance', 'brand': 'RSA', 'distributor': 'ZZZ Security Pte Ltd', 'quote_currency': 'USD', 'quantity': 12, 'serial_no': 'NEW', 'unit_price': 27875.00, 'total_price': 334500.00, 'start_date': 'TBA', 'end_date': 'TBA', 'quotation_ref_no': 'MTSG-QT20231017 Rev 3', 'quotation_date': '2026-01-09', 'quotation_end_date': '2026-08-19', 'quotation_validity': '30 days', 'eu_company': 'YYY', 'comments_notes': 'Tech refresh of 12 Current Appliance. Year 1-3 Appliance Maintenance'},
    {'sku': 'MT-HWM-2474-RSA', 'item_description': 'MTSG, Advance Hardware Replacement 24x7x4, Appliance 330, 1Yr', 'brand': 'RSA', 'distributor': 'ZZZ Security Pte Ltd', 'quote_currency': 'USD', 'quantity': 36, 'serial_no': 'NEW', 'unit_price': 390.00, 'total_price': 14040.00, 'start_date': 'TBA', 'end_date': 'TBA', 'quotation_ref_no': 'MTSG-QT20231017 Rev 3', 'quotation_date': '2026-01-09', 'quotation_end_date': '2026-08-19', 'quotation_validity': '30 days', 'eu_company': 'YYY', 'comments_notes': 'Year 1-3 Hardware Loaner'},
    {'sku': 'AUT0000250EE1-8', 'item_description': 'SID Access Ent EnhMnt 1Mo', 'brand': 'RSA', 'distributor': 'ZZZ Security Pte Ltd', 'quote_currency': 'USD', 'quantity': 200, 'serial_no': '81371374', 'unit_price': 110.00, 'total_price': 22000.00, 'start_date': '2026-05-01', 'end_date': '2028-04-30', 'quotation_ref_no': 'MTSG-QT20231017 Rev 3', 'quotation_date': '2026-01-09', 'quotation_end_date': '2026-08-19', 'quotation_validity': '30 days', 'eu_company': 'YYY', 'comments_notes': '36 Months Maintenance Renewal for 200 User License'},
    {'sku': 'SID700-6-60-36-100', 'item_description': 'RSA SecurID Authenticator SID700 (36 months) 100 Pack', 'brand': 'RSA', 'distributor': 'ZZZ Security Pte Ltd', 'quote_currency': 'USD', 'quantity': 1, 'serial_no': '81371374', 'unit_price': 5746.35, 'total_price': 5746.35, 'start_date': 'TBA', 'end_date': 'TBA', 'quotation_ref_no': 'MTSG-QT20231017 Rev 3', 'quotation_date': '2026-01-09', 'quotation_end_date': '2026-08-19', 'quotation_validity': '30 days', 'eu_company': 'YYY', 'comments_notes': 'Replace 100 Hard tokens expiring April 2028'},
    {'sku': 'SID700-6-60-36-100', 'item_description': 'RSA SecurID Authenticator SID700 (36 months) 100 Pack', 'brand': 'RSA', 'distributor': 'ZZZ Security Pte Ltd', 'quote_currency': 'USD', 'quantity': 1, 'serial_no': '81371374', 'unit_price': 5746.35, 'total_price': 5746.35, 'start_date': 'TBA', 'end_date': 'TBA', 'quotation_ref_no': 'MTSG-QT20231017 Rev 3', 'quotation_date': '2026-01-09', 'quotation_end_date': '2026-08-19', 'quotation_validity': '30 days', 'eu_company': 'YYY', 'comments_notes': 'Replace 100 Hard tokens expiring April 2028'},
]

SAMPLE_QUOTE_1_PDF_RECORDS = [
    {'sku': 'VSM-MDC-SM-PREM', 'item_description': 'Vault Self Managed Platform Multi DC Cluster - Small - Premium', 'brand': 'CyberArk', 'distributor': 'TechVault Solutions', 'quote_currency': 'USD', 'quantity': 3, 'serial_no': '', 'unit_price': 70183.71, 'total_price': 210551.14, 'start_date': '2024-03-01', 'end_date': '2025-02-28', 'quotation_ref_no': 'TV-QT-2024-0892', 'quotation_date': '2024-01-15', 'quotation_end_date': '2024-02-14', 'quotation_validity': '30 days', 'eu_company': 'Meridian Financial Services', 'comments_notes': ''},
    {'sku': 'VSM-MDC-CLT-200', 'item_description': 'Vault Self Managed Multi Data Center Client 200', 'brand': 'CyberArk', 'distributor': 'TechVault Solutions', 'quote_currency': 'USD', 'quantity': 200, 'serial_no': '', 'unit_price': 2526.61, 'total_price': 505321.00, 'start_date': '2024-03-01', 'end_date': '2025-02-28', 'quotation_ref_no': 'TV-QT-2024-0892', 'quotation_date': '2024-01-15', 'quotation_end_date': '2024-02-14', 'quotation_validity': '30 days', 'eu_company': 'Meridian Financial Services', 'comments_notes': ''},
    {'sku': 'VGS-SUP-0041', 'item_description': 'Vault Gold Support', 'brand': 'CyberArk', 'distributor': 'TechVault Solutions', 'quote_currency': 'USD', 'quantity': 1, 'serial_no': '', 'unit_price': 129138.01, 'total_price': 129138.01, 'start_date': '2024-03-01', 'end_date': '2025-02-28', 'quotation_ref_no': 'TV-QT-2024-0892', 'quotation_date': '2024-01-15', 'quotation_end_date': '2024-02-14', 'quotation_validity': '30 days', 'eu_company': 'Meridian Financial Services', 'comments_notes': 'Gold Support for VSM-MDC-SM-PREM'},
    {'sku': 'VSM-NP-CLT-001', 'item_description': 'Vault Self Managed Platform Cluster Non Production', 'brand': 'CyberArk', 'distributor': 'TechVault Solutions', 'quote_currency': 'USD', 'quantity': 2, 'serial_no': '', 'unit_price': 13475.27, 'total_price': 26950.54, 'start_date': '2024-03-01', 'end_date': '2025-02-28', 'quotation_ref_no': 'TV-QT-2024-0892', 'quotation_date': '2024-01-15', 'quotation_end_date': '2024-02-14', 'quotation_validity': '30 days', 'eu_company': 'Meridian Financial Services', 'comments_notes': 'Non-production environment'},
    {'sku': 'VGS-SUP-0017', 'item_description': 'Vault Gold Support', 'brand': 'CyberArk', 'distributor': 'TechVault Solutions', 'quote_currency': 'USD', 'quantity': 2, 'serial_no': '', 'unit_price': 2695.05, 'total_price': 5390.11, 'start_date': '2024-03-01', 'end_date': '2025-02-28', 'quotation_ref_no': 'TV-QT-2024-0892', 'quotation_date': '2024-01-15', 'quotation_end_date': '2024-02-14', 'quotation_validity': '30 days', 'eu_company': 'Meridian Financial Services', 'comments_notes': 'Gold Support for VSM-NP-CLT-001'},
    {'sku': 'VADP-KM-SM-050', 'item_description': 'Vault ADP KM - Small', 'brand': 'CyberArk', 'distributor': 'TechVault Solutions', 'quote_currency': 'USD', 'quantity': 50, 'serial_no': '', 'unit_price': 1216.52, 'total_price': 60826.00, 'start_date': '2024-03-01', 'end_date': '2025-02-28', 'quotation_ref_no': 'TV-QT-2024-0892', 'quotation_date': '2024-01-15', 'quotation_end_date': '2024-02-14', 'quotation_validity': '30 days', 'eu_company': 'Meridian Financial Services', 'comments_notes': ''},
    {'sku': 'VGS-SUP-0032', 'item_description': 'Vault Gold Support', 'brand': 'CyberArk', 'distributor': 'TechVault Solutions', 'quote_currency': 'USD', 'quantity': 1, 'serial_no': '', 'unit_price': 12165.20, 'total_price': 12165.20, 'start_date': '2024-03-01', 'end_date': '2025-02-28', 'quotation_ref_no': 'TV-QT-2024-0892', 'quotation_date': '2024-01-15', 'quotation_end_date': '2024-02-14', 'quotation_validity': '30 days', 'eu_company': 'Meridian Financial Services', 'comments_notes': 'Gold Support for VADP-KM-SM-050'},
    {'sku': 'VADP-TRF-050', 'item_description': 'Vault ADP Transform', 'brand': 'CyberArk', 'distributor': 'TechVault Solutions', 'quote_currency': 'USD', 'quantity': 50, 'serial_no': '', 'unit_price': 4491.76, 'total_price': 224587.78, 'start_date': '2024-03-01', 'end_date': '2025-02-28', 'quotation_ref_no': 'TV-QT-2024-0892', 'quotation_date': '2024-01-15', 'quotation_end_date': '2024-02-14', 'quotation_validity': '30 days', 'eu_company': 'Meridian Financial Services', 'comments_notes': ''},
    {'sku': 'VGS-SUP-0089', 'item_description': 'Vault Gold Support', 'brand': 'CyberArk', 'distributor': 'TechVault Solutions', 'quote_currency': 'USD', 'quantity': 1, 'serial_no': '', 'unit_price': 44917.57, 'total_price': 44917.57, 'start_date': '2024-03-01', 'end_date': '2025-02-28', 'quotation_ref_no': 'TV-QT-2024-0892', 'quotation_date': '2024-01-15', 'quotation_end_date': '2024-02-14', 'quotation_validity': '30 days', 'eu_company': 'Meridian Financial Services', 'comments_notes': 'Gold Support for VADP-TRF-050'},
]

SAMPLE_QUOTE_2_PDF_RECORDS = [
    {'sku': 'QSFP-110G-SR4-S', 'item_description': '110GBASE SR4 QSFP Transceiver, MPO, 110M', 'brand': 'Cisco', 'distributor': 'Kyphosis Solutions', 'quote_currency': 'USD', 'quantity': 80, 'serial_no': '', 'unit_price': 375.00, 'total_price': 30000.00, 'start_date': '2024-03-01', 'end_date': '2025-02-28', 'quotation_ref_no': 'KS-QT-2024-3847', 'quotation_date': '2024-02-10', 'quotation_end_date': '2024-03-11', 'quotation_validity': '30 days', 'eu_company': 'Pacific Rim Data Centers', 'comments_notes': 'Bulk order for DC expansion'},
]

SAMPLE_QUOTE_FILES = [
    ('Sample_Quote.xlsx', 'xlsx', 59492, SAMPLE_QUOTE_XLSX_RECORDS),
    ('Sample_Quote_1.pdf', 'pdf', 9724, SAMPLE_QUOTE_1_PDF_RECORDS),
    ('Sample_Quote_2.pdf', 'pdf', 114969, SAMPLE_QUOTE_2_PDF_RECORDS),
]


def seed_sample_quote_drafts(conn):
    """Pre-seed the 3 sample quotes as 'uploaded' with draft records, and copy files to data/uploads/."""
    now = datetime.now()
    upload_dir = Path(__file__).parent / 'data' / 'uploads'
    upload_dir.mkdir(parents=True, exist_ok=True)
    sample_dir = Path(__file__).parent / 'sample_quotes'

    total_drafts = 0
    for filename, ftype, fsize, records in SAMPLE_QUOTE_FILES:
        # Copy file to data/uploads/ so preview works
        src = sample_dir / filename
        dst = upload_dir / filename
        if src.exists() and not dst.exists():
            shutil.copy2(src, dst)

        # Insert uploaded_files entry with 'uploaded' status
        ts = (now - timedelta(hours=random.randint(1, 12))).strftime('%Y-%m-%d %H:%M:%S')
        conn.execute("""
            INSERT INTO uploaded_files
            (filename, original_name, file_type, file_size, upload_status, records_extracted, uploaded_at, processed_at)
            VALUES (?, ?, ?, ?, 'uploaded', ?, ?, ?)
        """, (filename, filename, ftype, fsize, len(records), ts, ts))

        # Insert draft records (is_current=0) for this file
        created = now.isoformat()
        for rec in records:
            conn.execute("""
                INSERT INTO records (
                    sku, distributor, item_description, brand, quote_currency,
                    quantity, serial_no, start_date, end_date,
                    unit_price, total_price, eu_company,
                    quotation_ref_no, quotation_date, quotation_end_date, quotation_validity,
                    comments_notes, source_file,
                    validation_status, validation_message,
                    is_current, user_modified, created_at, updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?)
            """, (
                rec['sku'], rec.get('distributor', ''), rec['item_description'],
                rec.get('brand', ''), rec.get('quote_currency', 'USD'),
                rec['quantity'], rec.get('serial_no', ''),
                rec.get('start_date', ''), rec.get('end_date', ''),
                rec['unit_price'], rec['total_price'], rec.get('eu_company', ''),
                rec.get('quotation_ref_no', ''), rec.get('quotation_date', ''),
                rec.get('quotation_end_date', ''), rec.get('quotation_validity', ''),
                rec.get('comments_notes', ''), filename,
                'pending', '', created, created,
            ))
            total_drafts += 1

    conn.commit()
    return total_drafts


def seed_uploaded_files(conn):
    now = datetime.now()
    files = [
        ('Cisco_Q1_2026_Quote.pdf', 'pdf', 245000, 8),
        ('RSA_Renewal_Quote.pdf', 'pdf', 182000, 5),
        ('Network_Quote.pdf', 'pdf', 310000, 12),
        ('HPE_Server_Proposal.xlsx', 'xlsx', 128000, 6),
    ]
    for name, ftype, size, recs in files:
        ts = (now - timedelta(hours=random.randint(2, 72))).strftime('%Y-%m-%d %H:%M:%S')
        conn.execute("""
            INSERT INTO uploaded_files
            (filename, original_name, file_type, file_size, upload_status, records_extracted, uploaded_at, processed_at)
            VALUES (?, ?, ?, ?, 'processed', ?, ?, ?)
        """, (name, name, ftype, size, recs, ts, ts))
    conn.commit()


def main():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Initialize tables first
    from procurement.services.database import init_db
    init_db()

    conn = sqlite3.connect(str(DB_PATH))
    try:
        # Check if already seeded
        cur = conn.execute("SELECT COUNT(*) FROM records WHERE is_current = 1")
        if cur.fetchone()[0] > 0:
            print("Database already has data. Skipping seed.")
            return

        n_rec = seed_active_records(conn)
        n_hist = seed_historical(conn)
        seed_uploaded_files(conn)
        n_drafts = seed_sample_quote_drafts(conn)

        cur = conn.execute("SELECT COUNT(*) FROM records WHERE is_current = 1")
        total_rec = cur.fetchone()[0]
        cur = conn.execute("SELECT COUNT(*) FROM historical_archive")
        total_hist = cur.fetchone()[0]

        print(f"Seeded {total_rec} active records + {total_hist} historical records across {len(COMPANIES)} companies.")
        print(f"Seeded {n_drafts} draft records from 3 sample quotes (appear as 'Newly Uploaded').")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
