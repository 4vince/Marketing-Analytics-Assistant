# Supervisor agent — unified chat entry point that classifies intent and routes
# to the appropriate sub-agent based on the user's role and message.
#
# Architecture:
#   User message + role ──► SupervisorAgent
#                               │
#                         classify_intent()  (keyword-based, no LLM call)
#                               │
#               ┌──────────────┼──────────────┐
#               │              │              │
#         customer          admin        admin analysis/
#         Storefront      AdminChat      report agents
#         ChatAgent        Agent
#               │              │              │
#               └──────────────┼──────────────┘
#                              │
#                         Response
#
# Security: Role-based access is enforced at the code level, not the prompt level.
# A customer can never invoke admin sub-agents, regardless of what the message says.
import logging
from typing import Any

from .base import ChatContext, ChatResponse
from .types import AgentType

logger = logging.getLogger(__name__)

# ── Keyword-based intent classification ──────────────────────────────────────
# Fast path: no LLM call needed. The sub-agent handles the full context.
# Falls back to "other" which routes to the default handler for the role.

_CUSTOMER_INTENTS: dict[str, list[str]] = {
    "product_question": [
        "product", "recommend", "suggest", "buy", "price", "cost", "catalog",
        "available", "sell", "looking for", "need a", "want to",
    ],
    "order_question": [
        "order", "shipping", "ship", "return", "refund", "track", "delivery",
        "status", "where is my", "cancel",
    ],
    "store_policy": [
        "hours", "location", "contact", "policy", "store", "open", "closed",
        "phone", "email", "address",
    ],
    "greeting": [
        "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
        "howdy", "greetings",
    ],
}

_ADMIN_INTENTS: dict[str, list[str]] = {
    "analytics_overview": [
        "how is", "overview", "summary", "dashboard", "performance",
        "how are things", "how's the store", "give me the",
    ],
    "product_analytics": [
        "product", "top selling", "best", "category", "inventory", "stock",
    ],
    "order_analytics": [
        "order", "recent order", "funnel", "paid", "refund", "pending",
        "failed", "revenue total", "sales",
    ],
    "traffic_analytics": [
        "traffic", "visitor", "visit", "source", "organic", "social",
    ],
    "campaign_analytics": [
        "campaign", "marketing", "ad", "roas", "spend", "impression",
        "conversion", "promotion",
    ],
    "seo_analytics": [
        "seo", "search", "ranking", "keyword", "rank", "position",
    ],
    "product_analysis": [
        "analyze", "analysis", "seo score", "content quality", "optimize",
        "product page", "review my",
    ],
    "report_generation": [
        "report", "quarterly", "generate", "create report", "make a report",
    ],
    "greeting": [
        "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
        "howdy", "greetings",
    ],
}

# Ordered by priority — first match wins. Longest patterns first to avoid
# false positives (e.g. "product_analysis" before "product_analytics").
_ADMIN_PATTERNS: list[tuple[str, list[str]]] = [
    ("product_analysis", _ADMIN_INTENTS["product_analysis"]),
    ("report_generation", _ADMIN_INTENTS["report_generation"]),
    ("analytics_overview", _ADMIN_INTENTS["analytics_overview"]),
    ("order_analytics", _ADMIN_INTENTS["order_analytics"]),
    ("product_analytics", _ADMIN_INTENTS["product_analytics"]),
    ("traffic_analytics", _ADMIN_INTENTS["traffic_analytics"]),
    ("campaign_analytics", _ADMIN_INTENTS["campaign_analytics"]),
    ("seo_analytics", _ADMIN_INTENTS["seo_analytics"]),
    ("greeting", _ADMIN_INTENTS["greeting"]),
]

_CUSTOMER_PATTERNS: list[tuple[str, list[str]]] = [
    ("product_question", _CUSTOMER_INTENTS["product_question"]),
    ("order_question", _CUSTOMER_INTENTS["order_question"]),
    ("store_policy", _CUSTOMER_INTENTS["store_policy"]),
    ("greeting", _CUSTOMER_INTENTS["greeting"]),
]


def _classify_intent(message: str, role: str) -> str:
    """Classify user message into an intent category using keyword matching.

    Returns a string intent name, or "other" if no pattern matches.
    Only returns intents valid for the given role.
    """
    msg = message.lower()

    patterns = _ADMIN_PATTERNS if role == "admin" else _CUSTOMER_PATTERNS
    for intent, keywords in patterns:
        for kw in keywords:
            if kw in msg:
                return intent

    return "other"


class SupervisorAgent:
    """Unified chat agent that routes to sub-agents based on intent + role.

    Usage:
        agent = SupervisorAgent()
        ctx = ChatContext(conversation_id="...", role="admin")
        response = await agent.respond("How is my store doing?", ctx)

    The context object should include a ``role`` field (via ChatContext or
    an extension) set to "admin" or "customer". Defaults to "customer" for
    safety — an unknown role gets storefront-only access.
    """

    def __init__(self) -> None:
        self._storefront_agent: Any = None
        self._admin_agent: Any = None
        self._initialized = False

    def _lazy_init(self) -> None:
        """Initialize sub-agents on first use (avoids circular imports at module level)."""
        if self._initialized:
            return
        self._storefront_agent = __import__(
            "agents.chat", fromlist=["StorefrontChatAgent"]
        ).StorefrontChatAgent()
        self._admin_agent = __import__(
            "agents.admin_chat", fromlist=["AdminChatAgent"]
        ).AdminChatAgent()
        self._initialized = True

    async def respond(self, message: str, context: ChatContext) -> ChatResponse:
        """Classify intent and route to the appropriate sub-agent.

        Security: Role is read from context. A customer can never invoke
        admin sub-agents — the routing table enforces this at the code level.
        """
        self._lazy_init()

        # Extract role from context (default to "customer" for safety)
        role = getattr(context, "role", "customer") or "customer"
        if role not in ("admin", "customer"):
            logger.warning(
                "[Supervisor] Unknown role '%s', defaulting to 'customer'",
                role,
            )
            role = "customer"

        # Classify intent (no LLM call — keyword-based for speed)
        intent = _classify_intent(message, role)
        logger.info(
            "[Supervisor] role=%s intent=%s msg=%.60s",
            role, intent, message,
        )

        # ── Route to sub-agent — enforced at code level ────────────────────
        if role == "admin":
            if intent in (
                "analytics_overview",
                "product_analytics",
                "order_analytics",
                "traffic_analytics",
                "campaign_analytics",
                "seo_analytics",
                "product_analysis",
                "report_generation",
                "greeting",
            ):
                return await self._admin_agent.respond(message, context)

            # Fallback for "other" admin intents — still use admin agent
            return await self._admin_agent.respond(message, context)

        # Customer role — all intents go to storefront agent
        return await self._storefront_agent.respond(message, context)
