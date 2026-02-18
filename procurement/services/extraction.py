"""
Document extraction service using H2OGPTE.
Extracts structured line items from procurement documents.
"""
import json
import re
import secrets
from pathlib import Path

from procurement.config.settings import EXTRACTION_PROMPT_PATH
from procurement.services.llm_service import get_h2ogpte_client, get_best_llm
from procurement.services.validation import validate_records

EXTRACTION_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "SKU": {"type": "string"},
                    "Distributor": {"type": "string"},
                    "Item Description": {"type": "string"},
                    "Brand": {"type": "string"},
                    "Quote Currency": {"type": "string"},
                    "Quantity": {"type": "number"},
                    "Serial No": {"type": "string"},
                    "Start Date": {"type": "string"},
                    "End Date": {"type": "string"},
                    "Unit Price": {"type": "number"},
                    "Total Price": {"type": "number"},
                    "EU Company": {"type": "string"},
                    "Comments/Notes": {"type": "string"},
                    "Quotation Ref No": {"type": "string"},
                    "Quotation Date": {"type": "string"},
                    "Quotation End Date": {"type": "string"},
                    "Quotation Validity": {"type": "string"},
                },
            },
        }
    },
    "required": ["items"],
}

# Mapping from LLM output field names to internal snake_case names
_FIELD_NAME_MAP = {
    'SKU': 'sku',
    'Distributor': 'distributor',
    'Item Description': 'item_description',
    'Brand': 'brand',
    'Quote Currency': 'quote_currency',
    'Quantity': 'quantity',
    'Serial No': 'serial_no',
    'Start Date': 'start_date',
    'End Date': 'end_date',
    'Unit Price': 'unit_price',
    'Total Price': 'total_price',
    'EU Company': 'eu_company',
    'Comments/Notes': 'comments_notes',
    'Quotation Ref No': 'quotation_ref_no',
    'Quotation Date': 'quotation_date',
    'Quotation End Date': 'quotation_end_date',
    'Quotation Validity': 'quotation_validity',
}

_NUMERIC_FIELDS = {'quantity', 'unit_price', 'total_price'}


def extract_document_with_llm(
    file_path: str,
    llm_client=None,
    filename: str = None,
) -> list[dict]:
    """Extract structured line items from a procurement document using H2OGPTE."""
    client = llm_client or get_h2ogpte_client()
    best_model = get_best_llm(client)
    collection_id = None

    if filename is None:
        filename = Path(file_path).name

    # Read extraction prompt
    prompt_path = Path(EXTRACTION_PROMPT_PATH)
    if prompt_path.exists():
        extraction_prompt = prompt_path.read_text()
    else:
        extraction_prompt = (
            "Extract all line items from this procurement document into JSON. "
            "Return {\"items\": [{...}, ...]} with fields: SKU, Distributor, "
            "Item Description, Brand, Quote Currency, Quantity, Serial No, "
            "Start Date, End Date, Unit Price, Total Price, EU Company, "
            "Comments/Notes, Quotation Ref No, Quotation Date, Quotation End Date, "
            "Quotation Validity."
        )

    try:
        # Upload document
        with open(file_path, 'rb') as f:
            upload_id = client.upload(filename, f)

        # Create temporary collection
        collection_id = client.create_collection(
            name=f"extraction_{filename}_{secrets.token_hex(4)}",
            description=f"Temporary collection for extracting {filename}",
        )

        # Ingest document
        client.ingest_uploads(collection_id, [upload_id], timeout=120)

        # Create chat session and query
        chat_session_id = client.create_chat_session(collection_id)
        with client.connect(chat_session_id) as session:
            reply = session.query(
                extraction_prompt,
                llm=best_model,
                llm_args={
                    'response_format': 'json_object',
                    'guided_json': EXTRACTION_JSON_SCHEMA,
                    'temperature': 0.1,
                },
                timeout=180,
            )

        # Parse response
        items = parse_extraction_response(reply.content)

        # Post-process
        normalized = [normalize_field_names(item) for item in items]
        for rec in normalized:
            rec['source_file'] = filename
            _convert_numerics(rec)

        # Validate
        validated = validate_records(normalized)
        return validated

    except Exception as e:
        raise RuntimeError(f"Extraction failed: {str(e)}") from e
    finally:
        if collection_id:
            try:
                client.delete_collections([collection_id])
            except Exception:
                pass


def parse_extraction_response(response_content: str) -> list[dict]:
    """Parse LLM response into a list of record dicts."""
    try:
        data = json.loads(response_content)
    except json.JSONDecodeError:
        # Try to find JSON in the response
        match = re.search(r'\[.*\]', response_content, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            match = re.search(r'\{.*\}', response_content, re.DOTALL)
            if match:
                data = json.loads(match.group())
            else:
                return []

    if isinstance(data, dict):
        if 'items' in data:
            return data['items']
        return [data]
    elif isinstance(data, list):
        return data
    return []


def normalize_field_names(record: dict) -> dict:
    """Convert LLM output field names to internal snake_case names."""
    normalized = {}
    for key, value in record.items():
        snake_key = _FIELD_NAME_MAP.get(key, key.lower().replace(' ', '_').replace('/', '_'))
        normalized[snake_key] = value
    return normalized


def _convert_numerics(record: dict):
    """Convert numeric string values to floats in-place."""
    for field in _NUMERIC_FIELDS:
        val = record.get(field)
        if val is None:
            continue
        if isinstance(val, str):
            cleaned = val.strip().replace(',', '').replace('$', '').replace(' ', '')
            try:
                record[field] = float(cleaned)
            except ValueError:
                pass
