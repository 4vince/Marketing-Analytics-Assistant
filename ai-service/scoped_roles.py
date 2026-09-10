# Idempotent DDL that provisions the scoped DB roles/views the chat agents
# rely on (storefront_user/admin_user + active_products_v/admin_analytics_v).
#
# Runs at AI-service startup so the scoped connections work regardless of how
# the schema was applied (prisma db push, prisma migrate, fresh compose volume).
# Content mirrors prisma/migrations/20260702000001_scoped_roles/migration.sql.
#
# Provisioning MUST connect as an owner-level role, so this uses the main
# DATABASE_URL (not DATABASE_URL_STOREFRONT/ADMIN, those roles are created here).
import os
import logging

import asyncpg

logger = logging.getLogger(__name__)

# One SQL command per entry (single-statement, idempotent).
_STATEMENTS = [
    # ── Roles (create or update password) ──
    """DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'storefront_user') THEN
        CREATE ROLE storefront_user WITH LOGIN PASSWORD 'storefront_dev_only' NOINHERIT;
    ELSE
        ALTER ROLE storefront_user WITH LOGIN PASSWORD 'storefront_dev_only' NOINHERIT;
    END IF;
END $$;""",
    """DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin_user') THEN
        CREATE ROLE admin_user WITH LOGIN PASSWORD 'admin_dev_only' NOINHERIT;
    ELSE
        ALTER ROLE admin_user WITH LOGIN PASSWORD 'admin_dev_only' NOINHERIT;
    END IF;
END $$;""",
    # ── Connectivity (derived from the current database) ──
    """DO $$ DECLARE dbname text;
    BEGIN
        SELECT current_database() INTO dbname;
        EXECUTE format('GRANT CONNECT ON DATABASE %I TO storefront_user', dbname);
        EXECUTE format('GRANT CONNECT ON DATABASE %I TO admin_user', dbname);
    END $$;""",
    "GRANT USAGE ON SCHEMA public TO storefront_user;",
    "GRANT USAGE ON SCHEMA public TO admin_user;",
    # ── Public product view (storefront) ──
    "DROP VIEW IF EXISTS active_products_v;",
    """CREATE VIEW active_products_v AS
    SELECT id, name, slug, description, price, images, category
    FROM products
    WHERE status = 'active';""",
    "GRANT SELECT ON active_products_v TO storefront_user;",
    "GRANT SELECT (category) ON products TO storefront_user;",
    # ── Analytics view (admin, convenience) ──
    "DROP VIEW IF EXISTS admin_analytics_v;",
    """CREATE VIEW admin_analytics_v AS
    SELECT
        (SELECT COUNT(*) FROM products) AS total_products,
        (SELECT COUNT(*) FROM products WHERE status = 'active') AS active_products,
        (SELECT COUNT(*) FROM orders) AS total_orders,
        (SELECT COALESCE(SUM(total), 0) FROM orders) AS total_revenue,
        (SELECT COUNT(*) FROM orders WHERE status = 'paid') AS paid_orders,
        (SELECT COUNT(*) FROM orders WHERE created_at >= NOW() - INTERVAL '30 days') AS orders_last_30d;""",
    "GRANT SELECT ON admin_analytics_v TO admin_user;",
    # ── Admin read-only on all tables ──
    "GRANT SELECT ON ALL TABLES IN SCHEMA public TO admin_user;",
    "REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM admin_user;",
    "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO admin_user;",
]


async def ensure_scoped_roles(dsn: str | None = None) -> dict[str, int]:
    """Create/update scoped roles and views.

    Returns counts of statements that succeeded/failed. Failures are logged,
    not raised, so a partial environment doesn't block service startup.
    """
    dsn = dsn or os.getenv("DATABASE_URL")
    if not dsn:
        logger.warning("[scoped_roles] DATABASE_URL not set — skipping bootstrap")
        return {"succeeded": 0, "failed": len(_STATEMENTS)}

    ok = failed = 0
    conn = None
    try:
        conn = await asyncpg.connect(dsn=dsn, timeout=10)
        for statement in _STATEMENTS:
            try:
                await conn.execute(statement.strip().rstrip(";"))
                ok += 1
            except Exception as e:
                logger.warning("[scoped_roles] Statement failed: %s", e)
                failed += 1
        logger.info("[scoped_roles] Bootstrap complete: %d statements ok, %d failed", ok, failed)
    except Exception as e:
        logger.warning("[scoped_roles] Could not connect (%s) — skipping bootstrap", e)
        failed = len(_STATEMENTS)
    finally:
        if conn is not None:
            await conn.close()
    return {"succeeded": ok, "failed": failed}