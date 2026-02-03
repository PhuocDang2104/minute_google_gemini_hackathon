# Migration: Add Project Objective Field

## 📋 Overview

Thêm field `objective` (mục tiêu dự án) vào bảng `project` và cập nhật toàn bộ stack (backend + frontend).

**Date:** 2024-12-26  
**Version:** v0.8.0

---

## 🎯 Changes Summary

### Database Schema
- ✅ Added `description` column (TEXT) to `project` table
- ✅ Added `objective` column (TEXT) to `project` table

### Backend
- ✅ Updated `Project` model (`app/models/user.py`)
- ✅ Updated `ProjectBase`, `ProjectCreate`, `ProjectUpdate` schemas
- ✅ Updated `project_service.py` (all CRUD operations)
- ✅ Created Alembic migration file

### Frontend
- ✅ Updated `Project` interface (`shared/dto/project.ts`)
- ✅ Updated `CreateProjectModal` component
- ✅ Updated `Projects.tsx` page

---

## 🚀 How to Apply Migration

### Option 1: Using Alembic (Recommended for Production)

```bash
cd backend

# Run migration
alembic upgrade head

# Or run specific migration
alembic upgrade add_project_desc_obj
```

### Option 2: Manual SQL (For Aiven/Supabase)

Connect to your database and run:

```sql
-- From infra/postgres/init/06_add_project_objective.sql

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

### Option 3: Docker Compose (Local Development)

If starting fresh:

```bash
cd infra
docker compose down -v  # Remove old volumes
docker compose up -d --build  # Rebuild with new schema
```

The init script `06_add_project_objective.sql` will run automatically.

---

## 🧪 Testing

### 1. Backend API Test

```bash
# Create project with objective
curl -X POST "http://localhost:8000/api/v1/projects/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "code": "TEST-001",
    "objective": "Improve customer onboarding experience",
    "description": "Detailed project description here"
  }'

# Get project (should include objective)
curl "http://localhost:8000/api/v1/projects/{project_id}"
```

### 2. Frontend Test

1. Open MeetMate app
2. Navigate to Projects page
3. Click "Tạo dự án"
4. Fill in form including "Mục tiêu dự án" field
5. Submit and verify project is created with objective

---

## 📊 Database Schema (After Migration)

```sql
CREATE TABLE project (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organization(id),
    name VARCHAR NOT NULL,
    code VARCHAR,
    description TEXT,        -- NEW
    objective TEXT,          -- NEW
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 🔄 Rollback (If Needed)

### Using Alembic

```bash
alembic downgrade -1
```

### Manual SQL

```sql
ALTER TABLE project DROP COLUMN IF EXISTS objective;
ALTER TABLE project DROP COLUMN IF EXISTS description;
```

---

## 📝 API Changes

### POST /api/v1/projects/

**Request Body (NEW):**
```json
{
  "name": "Project Name",
  "code": "PROJ-001",
  "objective": "Project objectives and goals",  // NEW
  "description": "Project description",
  "organization_id": "uuid",
  "department_id": "uuid"
}
```

### PATCH /api/v1/projects/{id}

**Request Body (NEW):**
```json
{
  "objective": "Updated objectives"  // NEW field can be updated
}
```

### GET /api/v1/projects/{id}

**Response (NEW):**
```json
{
  "id": "uuid",
  "name": "Project Name",
  "code": "PROJ-001",
  "objective": "Project objectives",  // NEW
  "description": "Description",
  "created_at": "2024-12-26T10:00:00Z",
  "updated_at": "2024-12-26T10:00:00Z"
}
```

---

## ✅ Verification Checklist

- [ ] Database migration applied successfully
- [ ] Backend can create projects with `objective`
- [ ] Backend can read projects with `objective`
- [ ] Backend can update `objective` field
- [ ] Frontend form shows "Mục tiêu dự án" field
- [ ] Frontend can submit projects with objective
- [ ] Frontend displays objective in project details
- [ ] No breaking changes for existing projects (NULL values OK)

---

## 🐛 Troubleshooting

### Error: Column already exists

This is safe to ignore. The migration uses `IF NOT EXISTS` checks.

### Error: Permission denied

Make sure your database user has ALTER TABLE permissions:

```sql
GRANT ALTER ON TABLE project TO your_user;
```

### Frontend TypeScript errors

Run:

```bash
cd electron
npm run typecheck
```

If errors persist, restart TypeScript server in your IDE.

---

## 📚 Related Files

**Backend:**
- `backend/app/models/user.py` (line 29-37)
- `backend/app/schemas/project.py` (line 6-24)
- `backend/app/services/project_service.py` (multiple functions)
- `backend/alembic/versions/add_project_description_objective.py`

**Frontend:**
- `electron/src/renderer/shared/dto/project.ts` (line 1-11)
- `electron/src/renderer/app/routes/Projects/CreateProjectModal.tsx` (line 1-90)
- `electron/src/renderer/app/routes/Projects.tsx` (line 15-53)

**Database:**
- `infra/postgres/init/06_add_project_objective.sql`

---

**Migration completed successfully! 🎉**

