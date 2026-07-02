# Agent type definitions — used to scope skills, database credentials, and tool access.
# Storefront and admin agents are distinct types with no overlapping capabilities.
import enum


class AgentType(enum.Enum):
    """Agent type used to scope skills, DB credentials, and tool access.

    STOREFRONT agents serve customers — they get storefront-only skills,
    a DB role scoped to public product views, and no access to admin data.
    ADMIN agents serve store admins — they get admin-only skills,
    a DB role scoped to analytics views (read-only), and no access to
    product creation/mutation.
    """
    STOREFRONT = "storefront"
    ADMIN = "admin"


# Map agent type → skill directory name (relative to skills/ root).
# This is the ONLY place this mapping lives. Adding a new agent type
# means adding an entry here and a corresponding directory in skills/.
SKILL_DIR_MAP: dict[AgentType, str] = {
    AgentType.STOREFRONT: "storefront",
    AgentType.ADMIN: "admin",
}
