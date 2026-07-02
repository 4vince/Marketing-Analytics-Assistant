# Cross-contamination sanitizer — strips prompt injection attempts and
# untrusted content from customer-originated text before it reaches
# any admin context pipeline.
#
# Treat any text that originated from a customer (chat messages, product
# reviews, support tickets, flagged messages) as untrusted input. This
# module removes or neutralizes known prompt-injection patterns so the
# sanitized text can be safely included in a system prompt or analysis context
# without allowing the customer to escalate privileges or alter agent behavior.
import re
from typing import Any

# ── Known prompt injection patterns ──────────────────────────────────────────
# These are matched case-insensitively. The list is intentionally focused on
# patterns that attempt to change agent role, override system instructions,
# or leak context — not generic "bad words" filtering.
_INJECTION_PATTERNS: list[re.Pattern] = [
    # Role-change attempts
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above|the\s+above)\s+(instructions|directions|commands|rules)", re.IGNORECASE),
    re.compile(r"you\s+are\s+(now|no longer|not)\s+(an?\s+)?(.*?)(assistant|bot|agent|ai|terminal|computer|system|expert|analyst|\w+mode)", re.IGNORECASE),
    re.compile(r"forget(\s+everything|\s+all\s+(previous|prior))?", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?(previous|prior|above)", re.IGNORECASE),
    re.compile(r"new\s+(instruction|direction|command|rule|prompt)\s*:", re.IGNORECASE),
    re.compile(r"system\s+(prompt|instruction|message)\s*:", re.IGNORECASE),
    re.compile(r"you\s+must\s+(now\s+)?(act|behave|respond|answer)\s+as", re.IGNORECASE),
    # Attempts to reveal system prompt
    re.compile(r"repeat\s+(everything|all|the\s+(system|above|initial))", re.IGNORECASE),
    re.compile(r"print\s+(your\s+)?(system|instructions|prompt|directives)", re.IGNORECASE),
    re.compile(r"output\s+(your\s+)?(system|initial|above)\s+(prompt|instructions|text)", re.IGNORECASE),
    re.compile(r"show\s+(me\s+)?(your\s+)?(system|instructions|prompt|directives)", re.IGNORECASE),
    re.compile(r"what('s| is)\s+(your\s+)?(system|instructions|prompt|role|directives)", re.IGNORECASE),
    # Escape / delimiter breaking
    re.compile(r"---+\s*(begin|end|start|system|new)", re.IGNORECASE),
    re.compile(r"<\s*(system|user|assistant)\s*>", re.IGNORECASE),
    # Admin mode escalation
    re.compile(r"(admin|administrator)\s*(mode|override|access|bypass)", re.IGNORECASE),
    re.compile(r"you\s+are\s+(now\s+an\s+)?admin", re.IGNORECASE),
    re.compile(r"this\s+is\s+(an\s+)?(admin|urgent|authorized|override)\s+(command|instruction|request)", re.IGNORECASE),
]

# Characters allowed in sanitized text (printable ASCII + common Unicode punctuation)
_ALLOWED_CHARS = re.compile(r"[^\x20-\x7E\s -ÿ‐-‧‰-⁞]")


def contains_injection_attempt(text: str) -> bool:
    """Check if text contains known prompt injection patterns.

    Returns True if any pattern matches. Used for logging/metrics,
    not as a sole security measure — sanitization still applies.
    """
    if not text:
        return False
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(text):
            return True
    return False


def strip_injection_attempts(text: str, replacement: str = " [REDACTED] ") -> str:
    """Remove or neutralize known prompt injection patterns.

    Matched patterns are replaced with the given replacement string.
    This is the primary sanitization function.
    """
    if not text:
        return text
    result = text
    for pattern in _INJECTION_PATTERNS:
        result = pattern.sub(replacement, result)
    return result


def sanitize_customer_text(text: str, max_length: int = 2000, strip_non_ascii: bool = False) -> str:
    """Sanitize customer-originated text before it reaches admin context.

    Applies in order:
    1. Strip non-printable / unusual characters
    2. Remove known prompt injection patterns
    3. Truncate to max_length

    Args:
        text: The customer-originated text to sanitize.
        max_length: Maximum allowed length (default 2000 chars).
        strip_non_ascii: If True, remove chars outside printable ASCII range.

    Returns:
        Sanitized, safe text.
    """
    if not text:
        return text

    # Step 1: Strip unusual characters
    if strip_non_ascii:
        text = _ALLOWED_CHARS.sub("", text)

    # Step 2: Remove injection attempts
    text = strip_injection_attempts(text)

    # Step 3: Truncate
    if len(text) > max_length:
        text = text[:max_length] + " [...]"

    return text


def _sanitize_value(value: Any) -> Any:
    """Recursively sanitize a value, handling nested dicts and lists."""
    if isinstance(value, str):
        return sanitize_customer_text(value)
    elif isinstance(value, dict):
        return {k: _sanitize_value(v) for k, v in value.items()}
    elif isinstance(value, list):
        return [_sanitize_value(v) for v in value]
    return value


def sanitize_context_list(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sanitize a list of context records that may contain customer-originated text.

    Recursively sanitizes all string fields in nested dicts and lists.
    Useful for sanitizing product catalogs, recent orders, reviews, etc.
    before they enter an admin agent's prompt.
    """
    return [_sanitize_value(item) for item in items]  # type: ignore[return-value]
