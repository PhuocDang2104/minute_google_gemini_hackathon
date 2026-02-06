import os
import sys
from pathlib import Path
from logging.config import fileConfig   # Cấu hình logging
from typing_extensions import runtime
from sqlalchemy import engine_from_config   #Tạo SQLAlchemy engine
from sqlalchemy import pool # Quản lý kết nối DB
from alembic import context # Alembic migration context
# Ensure backend/ is on sys.path so `import app` works in all environments.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings

# this is the Alembic Config object, which provides access to the values within the .ini file in use.
config = context.config

settings = get_settings()
# Override sqlalchemy.url with environment variable
database_url = settings.database_url
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
config.set_main_option("sqlalchemy.url", database_url)

if config.config_file_name is not None:
    try:
        fileConfig(config.config_file_name)
    except KeyError:
        # alembic.ini không define logging đầy đủ (formatters/handlers/loggers)
        # → bỏ qua logging, vẫn chạy migration bình thường
        pass

from app.db.base import Base  # noqa: E402
from app import models  # noqa: E402,F401


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=Base.metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    # Handle config section safely
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = database_url
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=Base.metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
