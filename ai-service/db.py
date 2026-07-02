# Scoped database connection pool — provides Postgres connections with
# agent-type-specific credentials so that data access is enforced at the
# database layer, not the prompt layer.
#
# StorefrontChatAgent gets a role that can only read public product views.
# AdminChatAgent gets a read-only role scoped to analytics/admin views.
# If the model hallucinates a query against tables outside its scope,
# the query fails at the database level.
import os
import logging
from typing import Any

from agents.types import AgentType

logger = logging.getLogger(__name__)

# Env vars for scoped connection strings. Falls back to DATABASE_URL
# for development environments where separate roles aren't configured.
_ENV_MAP: dict[AgentType, str] = {
    AgentType.STOREFRONT: "DATABASE_URL_STOREFRONT",
    AgentType.ADMIN: "DATABASE_URL_ADMIN",
}


class DatabasePool:
    """Async PostgreSQL connection pool with agent-type-scoped credentials.

    Usage:
        pool = DatabasePool()
        await pool.init()
        conn = await pool.get_connection(AgentType.STOREFRONT)
        # conn is connected as storefront_user — can only see product views
        rows = await conn.fetch("SELECT * FROM active_products_v")
        await pool.close()

    Each agent type connects with a different Postgres role that has
    minimal SELECT permissions on only the tables/views it needs.
    """

    def __init__(self) -> None:
        self._pools: dict[AgentType, Any] = {}
        self._initialized = False

    async def init(self) -> None:
        """Initialize connection pools for all configured agent types.

        Pools are lazily created on first use per agent type. This
        pre-creates them so startup cost is paid at init, not on the
        first request.
        """
        import asyncpg

        for agent_type in AgentType:
            dsn = self._get_dsn(agent_type)
            if not dsn:
                logger.info(
                    "[DB] No scoped DSN for %s — skipping pool",
                    agent_type.value,
                )
                continue
            try:
                self._pools[agent_type] = await asyncpg.create_pool(
                    dsn=dsn,
                    min_size=1,
                    max_size=4,
                    command_timeout=10,
                    statement_cache_size=0,
                )
                logger.info(
                    "[DB] Pool created for %s", agent_type.value
                )
            except Exception as e:
                logger.warning(
                    "[DB] Failed to create pool for %s: %s",
                    agent_type.value,
                    e,
                )
        self._initialized = True

    async def get_connection(self, agent_type: AgentType) -> Any | None:
        """Get a connection from the pool for the given agent type.

        Returns None if the pool isn't available (not configured or
        init failed). Never falls back to a different agent type's pool.
        """
        if not self._initialized:
            await self.init()

        pool = self._pools.get(agent_type)
        if pool is None:
            return None
        try:
            return await pool.acquire()
        except Exception as e:
            logger.error(
                "[DB] Failed to acquire connection for %s: %s",
                agent_type.value,
                e,
            )
            return None

    async def close(self) -> None:
        """Close all pools and release connections."""
        for agent_type, pool in self._pools.items():
            try:
                await pool.close()
                logger.info(
                    "[DB] Pool closed for %s", agent_type.value
                )
            except Exception as e:
                logger.warning(
                    "[DB] Error closing pool for %s: %s",
                    agent_type.value,
                    e,
                )
        self._pools.clear()
        self._initialized = False

    @staticmethod
    def _get_dsn(agent_type: AgentType) -> str | None:
        """Get the connection string for the given agent type.

        Uses the agent-type-specific env var if set, otherwise falls
        back to the generic DATABASE_URL for development convenience.
        """
        env_var = _ENV_MAP.get(agent_type)
        if not env_var:
            return None
        return os.getenv(env_var) or os.getenv("DATABASE_URL")


# Module-level singleton — initialized once at app startup.
pool: DatabasePool = DatabasePool()
