import sys
import os
from pathlib import Path

# Add backend to python path
backend_path = Path("backend").resolve()
sys.path.append(str(backend_path))

print(f"Checking imports from: {backend_path}")

try:
    # Attempt to import main application
    # This triggers imports of all routers, services, models, schemas
    import app.main
    print("✅ Successfully imported app.main")
    
    from app.core.config import get_settings
    settings = get_settings()
    print(f"✅ Configuration loaded. ENV={settings.env}")
    print(f"✅ Database Config: URL starts with {settings.database_url.split(':')[0]}")
    
    # Check SQLAlchemy dependencies
    try:
        import sqlalchemy
        import psycopg2
        print(f"✅ SQLAlchemy {sqlalchemy.__version__} and psycopg2 are installed")
    except ImportError as e:
        print(f"❌ Database driver missing: {e}")
        sys.exit(1)

    print("\nBackend integrity check passed!")
    
except ImportError as e:
    print(f"\n❌ Import Error: {e}")
    # Print the full traceback to help identify the missing dependency
    import traceback
    traceback.print_exc()
    sys.exit(1)
except Exception as e:
    print(f"\n❌ Startup Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
