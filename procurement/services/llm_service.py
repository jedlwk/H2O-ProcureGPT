"""
H2OGPTE LLM service for document verification, extraction support, and analyst queries.
"""
import os
import secrets
from dataclasses import dataclass, field

from procurement.config.settings import H2OGPTE_API_KEY, H2OGPTE_ADDRESS

_h2ogpte_client = None

# Model preference order
_MODEL_PREFERENCE = [
    'claude-opus-4-1', 'claude-opus-4', 'claude-sonnet-4-5', 'claude-sonnet-4',
    'gpt-5-mini', 'o3', 'o4-mini', 'gpt-4.1', 'gpt-4o',
    'gemini-2.5-pro', 'claude-3-5-sonnet',
]


@dataclass
class AnalystResponse:
    response: str
    suggestions: list = field(default_factory=list)
    confidence: float = 0.85


def get_h2ogpte_client():
    """Get or create singleton H2OGPTE client."""
    global _h2ogpte_client
    if _h2ogpte_client is not None:
        return _h2ogpte_client

    if not H2OGPTE_API_KEY or not H2OGPTE_ADDRESS:
        raise RuntimeError(
            "H2OGPTE is not configured. Set H2OGPTE_API_KEY and H2OGPTE_ADDRESS in .env"
        )

    from h2ogpte import H2OGPTE
    _h2ogpte_client = H2OGPTE(address=H2OGPTE_ADDRESS, api_key=H2OGPTE_API_KEY)
    return _h2ogpte_client


def verify_h2ogpte_connection() -> bool:
    """Verify H2OGPTE connectivity by listing models. Returns True if OK."""
    try:
        client = get_h2ogpte_client()
        models = client.get_llms()
        return len(models) > 0
    except Exception:
        return False


def get_best_llm(client) -> str:
    """Select the best available LLM from the preference list."""
    try:
        models = client.get_llms()
    except Exception:
        return 'auto'

    model_ids = []
    for m in models:
        if isinstance(m, str):
            model_ids.append(m)
        elif isinstance(m, dict):
            model_ids.append(m.get('name', m.get('display_name', '')))
        else:
            model_ids.append(getattr(m, 'name', getattr(m, 'display_name', str(m))))

    model_ids_lower = [mid.lower() for mid in model_ids]

    for pref in _MODEL_PREFERENCE:
        for i, mid_lower in enumerate(model_ids_lower):
            if pref.lower() in mid_lower:
                return model_ids[i]

    if model_ids:
        return model_ids[0]
    return 'auto'


def verify_procurement_document(file_path: str, filename: str) -> bool:
    """Quick pre-check whether a file is a procurement document."""
    client = get_h2ogpte_client()
    best_model = get_best_llm(client)
    collection_id = None

    try:
        with open(file_path, 'rb') as f:
            upload_id = client.upload(filename, f)

        collection_id = client.create_collection(
            name=f"verify_{secrets.token_hex(4)}",
            description="Document verification",
        )
        client.ingest_uploads(collection_id, [upload_id], timeout=60)

        chat_session_id = client.create_chat_session(collection_id)
        with client.connect(chat_session_id) as session:
            reply = session.query(
                "Is this a procurement quotation, purchase order, invoice, or price list document? "
                "Answer with ONLY 'YES' or 'NO'.",
                llm=best_model,
                llm_args={'temperature': 0.0},
                timeout=30,
            )
        return 'YES' in reply.content.upper()
    except Exception:
        return False
    finally:
        if collection_id:
            try:
                client.delete_collections([collection_id])
            except Exception:
                pass


def query_analyst(
    query: str,
    context_records: list[dict] = None,
    historical_summary: dict = None,
) -> AnalystResponse:
    """Send a question to the AI analyst with procurement context."""
    client = get_h2ogpte_client()
    system_prompt = _build_analyst_system_prompt(context_records, historical_summary)

    try:
        chat_session_id = client.create_chat_session()
        with client.connect(chat_session_id) as session:
            reply = session.query(
                f"{system_prompt}\n\nUser Question: {query}",
                llm='auto',
                llm_args={'temperature': 0.7},
                timeout=60,
            )

        suggestions = _generate_suggestions(query)
        return AnalystResponse(
            response=reply.content,
            suggestions=suggestions,
            confidence=0.85,
        )
    except Exception as e:
        return AnalystResponse(
            response=f"I encountered an error processing your question: {str(e)}",
            suggestions=["Try rephrasing your question", "Check H2OGPTE connection"],
            confidence=0.0,
        )


def _build_analyst_system_prompt(
    context_records: list[dict] = None,
    historical_summary: dict = None,
) -> str:
    """Build the system prompt with procurement data context."""
    import json

    parts = [
        "You are a procurement analyst assistant powered by H2OGPTE. "
        "You help analyze procurement data, compare pricing, identify trends, "
        "and provide actionable recommendations for procurement decisions."
    ]

    if context_records:
        parts.append(f"\n\nCurrent Records ({len(context_records)} items):")
        sample = context_records[:10]
        parts.append(json.dumps(sample, indent=2, default=str))
        if len(context_records) > 10:
            skus = list({r.get('sku', '') for r in context_records if r.get('sku')})
            parts.append(f"\n... and {len(context_records) - 10} more records. All SKUs: {', '.join(skus[:20])}")

    if historical_summary:
        parts.append(f"\n\nHistorical Summary:")
        parts.append(json.dumps(historical_summary, indent=2, default=str))

    return '\n'.join(parts)


def _generate_suggestions(query: str) -> list[str]:
    """Generate follow-up question suggestions based on query keywords."""
    query_lower = query.lower()
    suggestions = []

    if any(w in query_lower for w in ['price', 'cost', 'expensive', 'cheap']):
        suggestions.extend([
            "Which SKUs have the highest price variance?",
            "Compare prices across distributors",
            "What's the overall price trend over the past year?",
        ])
    elif any(w in query_lower for w in ['trend', 'history', 'historical']):
        suggestions.extend([
            "Are there any seasonal pricing patterns?",
            "Which items have increased in price the most?",
            "Show price stability analysis",
        ])
    elif any(w in query_lower for w in ['valid', 'error', 'warning', 'issue']):
        suggestions.extend([
            "What are the most common validation errors?",
            "Which records need immediate attention?",
            "Summarize data quality issues",
        ])
    else:
        suggestions.extend([
            "Is this quotation competitive compared to history?",
            "Which items should I negotiate on?",
            "Summarize pricing trends for top SKUs",
            "What's the total spend impact?",
        ])

    return suggestions[:4]
