"""
MySQL base connection and query utilities
"""
import asyncio
import mysql.connector
from typing import List, Dict, Any, Optional
from mysql.connector import pooling
from ...core.config import get_mysql_config


class DatabaseManager:
    """Database connection manager.

    MySQL is treated as an optional runtime dependency:
    - Missing MYSQL_* env vars should not block backend startup.
    - SQL tools will fail at call time with a readable error message.
    """

    def __init__(self):
        self.config: Optional[Dict[str, Any]] = None
        self.pool: Optional[pooling.MySQLConnectionPool] = None
        self._config_error: Optional[str] = None

        try:
            self.config = get_mysql_config()
            self._init_pool()
        except Exception as e:
            self._config_error = str(e)
            self.config = None
            self.pool = None
            print(f"[MySQL] Disabled at startup: {self._config_error}")

    def _init_pool(self):
        """Initialize connection pool."""
        if not self.config:
            return
        try:
            self.pool = mysql.connector.pooling.MySQLConnectionPool(
                pool_name="business_pool",
                pool_size=5,
                **self.config,
            )
        except Exception as e:
            self.pool = None
            print(f"[MySQL] Pool init failed: {e}")

    def get_connection(self):
        """Get a connection from the pool."""
        if self._config_error:
            raise RuntimeError(
                f"MySQL is not configured: {self._config_error}. "
                "Please set MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD/MYSQL_DATABASE and restart backend."
            )
        if not self.pool:
            self._init_pool()
        if not self.pool:
            raise RuntimeError(
                "MySQL connection pool is unavailable. "
                "Please ensure MySQL service is reachable and MYSQL_* env vars are correct."
            )
        return self.pool.get_connection()

    async def execute_query(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """Execute a query and return results."""

        def _execute():
            conn = self.get_connection()
            try:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(query, params or ())
                results = cursor.fetchall()
                cursor.close()
                return results
            finally:
                conn.close()

        # Run in thread pool to avoid blocking.
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _execute)

    async def execute_many(self, query: str, params_list: List[tuple]) -> int:
        """Execute multiple queries."""

        def _execute():
            conn = self.get_connection()
            try:
                cursor = conn.cursor()
                cursor.executemany(query, params_list)
                conn.commit()
                affected_rows = cursor.rowcount
                cursor.close()
                return affected_rows
            finally:
                conn.close()

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _execute)


# Global database manager instance
db_manager = DatabaseManager()
