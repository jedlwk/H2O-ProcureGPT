"""
Application configuration loaded from environment variables.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent.parent.parent
load_dotenv(BASE_DIR / '.env')

# Database
DATABASE_PATH = os.getenv('DATABASE_PATH', str(BASE_DIR / 'data' / 'document_intel.db'))

# H2OGPTE
H2OGPTE_API_KEY = os.getenv('H2OGPTE_API_KEY', '')
H2OGPTE_ADDRESS = os.getenv('H2OGPTE_ADDRESS', '')

# File uploads
UPLOAD_DIR = os.getenv('UPLOAD_DIR', str(BASE_DIR / 'data' / 'uploads'))
ALLOWED_EXTENSIONS = {'pdf', 'xlsx', 'xls', 'csv', 'doc', 'docx'}

# Validation
COMPULSORY_FIELDS = {
    'sku', 'distributor', 'item_description', 'quote_currency',
    'quantity', 'serial_no', 'unit_price', 'total_price',
    'eu_company', 'quotation_ref_no',
}

SUPPORTED_CURRENCIES = {'SGD', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'MYR', 'AUD', 'ALL'}

# Extraction prompt
EXTRACTION_PROMPT_PATH = str(BASE_DIR / 'extraction_prompt.txt')
