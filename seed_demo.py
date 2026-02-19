"""
Seed the database with demo data.
Run once after cloning: python seed_demo.py
Creates 5 companies with active records and 18 months of historical records,
including historical pricing for all 3 sample quote files (sample_quotes/).
"""
import sqlite3
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
            created = (now - timedelta(days=random.randint(0, 55))).isoformat()
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


def seed_uploaded_files(conn):
    now = datetime.now()
    files = [
        ('Cisco_Q1_2026_Quote.pdf', 'pdf', 245000, 8),
        ('RSA_Renewal_Quote.pdf', 'pdf', 182000, 5),
        ('Sample_Quote.xlsx', 'xlsx', 59492, 5),
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

        cur = conn.execute("SELECT COUNT(*) FROM records WHERE is_current = 1")
        total_rec = cur.fetchone()[0]
        cur = conn.execute("SELECT COUNT(*) FROM historical_archive")
        total_hist = cur.fetchone()[0]

        print(f"Seeded {total_rec} active records + {total_hist} historical records across {len(COMPANIES)} companies.")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
