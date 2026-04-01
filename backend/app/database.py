# from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
# from sqlalchemy.orm import declarative_base
# from app.config import settings

# engine = create_async_engine(
#     settings.DATABASE_URL,
#     echo=False,
#     future=True,
# )

# AsyncSessionLocal = async_sessionmaker(
#     engine, expire_on_commit=False
# )

# Base = declarative_base()


# async def get_db():
#     async with AsyncSessionLocal() as session:
#         yield session




# from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
# from sqlalchemy.orm import declarative_base, sessionmaker
# from sqlalchemy import create_engine
# from app.config import settings

# # ✅ ASYNC ENGINE (already exists)
# engine = create_async_engine(
#     settings.DATABASE_URL,
#     echo=False,
#     future=True,
# )

# AsyncSessionLocal = async_sessionmaker(
#     engine, expire_on_commit=False
# )

# # ✅ SYNC ENGINE (ADD THIS)
# SYNC_DATABASE_URL = settings.DATABASE_URL.replace("+asyncpg", "")

# sync_engine = create_engine(SYNC_DATABASE_URL)

# SessionLocal = sessionmaker(
#     autocommit=False,
#     autoflush=False,
#     bind=sync_engine
# )

# Base = declarative_base()


# async def get_db():
#     async with AsyncSessionLocal() as session:
#         yield session


from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import create_engine
from app.config import settings

# ✅ ASYNC ENGINE
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False
)

# ✅ SYNC ENGINE (ADD THIS)
SYNC_DATABASE_URL = settings.DATABASE_URL.replace("+asyncpg", "")

sync_engine = create_engine(SYNC_DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=sync_engine
)

# ✅ BASE
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


def get_db_sync():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()