# 🚀 Quick Migration Guide - Add Project Objective

## For Aiven Database (Production)

### Step 1: Connect to Aiven Database

```bash
# Using psql
psql "postgresql://user:password@host:port/database?sslmode=require"

# Or use Aiven Console SQL Editor
```

### Step 2: Run Migration SQL

```sql
-- Add description column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='project' AND column_name='description'
    ) THEN
        ALTER TABLE project ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add objective column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='project' AND column_name='objective'
    ) THEN
        ALTER TABLE project ADD COLUMN objective TEXT;
    END IF;
END $$;
```

### Step 3: Verify

```sql
-- Check columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'project' 
  AND column_name IN ('description', 'objective');

-- Should return:
--  column_name | data_type 
-- -------------+-----------
--  description | text
--  objective   | text
```

### Step 4: Deploy Backend

```bash
# Backend will automatically use new fields
# No code changes needed if you pulled latest code

# Restart backend service (if already running)
# For Render: Will auto-deploy on git push
# For local: Restart uvicorn
```

### Step 5: Deploy Frontend

```bash
cd electron
npm run build

# Or for web deployment:
# Deploy to Vercel/Netlify
```

---

## For Local Development (Docker)

### Fresh Start (Easiest)

```bash
cd infra
docker compose down -v  # Remove volumes
docker compose up -d --build  # Rebuild
```

The new schema will be applied automatically from `06_add_project_objective.sql`.

### Existing Database

```bash
# Connect to running postgres container
docker exec -it infra-postgres-1 psql -U meetmate -d meetmate

# Run migration SQL (same as above)
```

---

## ✅ Quick Test

### Backend Test

```bash
curl -X POST "http://localhost:8000/api/v1/projects/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "objective": "Test objective field"
  }'
```

### Frontend Test

1. Open app
2. Go to Projects
3. Click "Tạo dự án"
4. See "Mục tiêu dự án" field ✅

---

## 🔥 One-Liner for Aiven

```sql
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project' AND column_name='description') THEN ALTER TABLE project ADD COLUMN description TEXT; END IF; IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project' AND column_name='objective') THEN ALTER TABLE project ADD COLUMN objective TEXT; END IF; END $$;
```

---

**Done! 🎉**

