# 📋 Minutes Template System - Implementation Summary

## ✅ Completed Backend Implementation

### **1. Database Schema**
- ✅ Created `minutes_template` table
- ✅ Added default templates (Default, Board Meeting, Compliance/Audit, Progress Review)
- ✅ Migration file: `infra/postgres/init/07_minutes_template.sql`

### **2. Models & Schemas**
- ✅ `backend/app/models/minutes_template.py` - SQLAlchemy model
- ✅ `backend/app/schemas/minutes_template.py` - Pydantic schemas
- ✅ Updated `GenerateMinutesRequest` to include `template_id`

### **3. Services**
- ✅ `backend/app/services/template_service.py` - CRUD operations
- ✅ `backend/app/services/template_formatter.py` - Template-based formatting
- ✅ Updated `minutes_service.py` to support template-based generation

### **4. API Endpoints**
- ✅ `backend/app/api/v1/endpoints/minutes_template.py` - Template CRUD endpoints
- ✅ Registered in `main.py` at `/api/v1/minutes-templates`

---

## 📋 API Endpoints

### **Template Management**

```
GET    /api/v1/minutes-templates              # List templates
GET    /api/v1/minutes-templates/default      # Get default template
GET    /api/v1/minutes-templates/{id}         # Get template by ID
POST   /api/v1/minutes-templates              # Create template
PUT    /api/v1/minutes-templates/{id}         # Update template
DELETE /api/v1/minutes-templates/{id}         # Delete template
POST   /api/v1/minutes-templates/{id}/set-default  # Set as default
```

### **Generate Minutes with Template**

```
POST /api/v1/minutes/generate
{
  "meeting_id": "...",
  "template_id": "...",  // Optional: use template
  "include_transcript": true,
  "format": "markdown"
}
```

---

## 🎯 How It Works

### **1. Template Structure**

Templates are stored as JSON with sections and fields:

```json
{
  "sections": [
    {
      "id": "header",
      "title": "THÔNG TIN CUỘC HỌP",
      "order": 1,
      "required": true,
      "fields": [
        {
          "id": "meeting_title",
          "label": "Tên cuộc họp",
          "type": "text",
          "required": true,
          "source": "meeting.title"
        }
      ]
    }
  ]
}
```

### **2. Field Sources**

Fields can pull data from:
- `meeting.*` - Meeting data (title, start_time, location, participants, etc.)
- `ai_generated` - AI-generated content (summary, key_points, decisions, actions, risks)

### **3. Generation Flow**

```
1. User selects template (or uses default)
   ↓
2. API receives template_id + meeting_id
   ↓
3. Load template structure
   ↓
4. Gather data:
   - Meeting info
   - Transcript
   - AI-generated summary/key_points
   - Actions, decisions, risks
   ↓
5. Map data to template fields
   ↓
6. Format according to template structure
   ↓
7. Return formatted minutes
```

---

## 🔧 Frontend Changes Needed

### **1. Remove Action Items/Decisions Tabs**

In `PostMeetTabFireflies.tsx`:
- Remove "Action Items" and "Decisions" thread tabs
- Keep only "AI Meeting Summary"

### **2. Add Template Selector**

Replace tabs with:
- Template dropdown selector
- Show template preview
- Generate button with selected template

### **3. Template Management UI**

Create new page/component:
- List templates
- Create/Edit template
- Template structure editor (JSON editor or visual builder)

---

## 📝 Next Steps

### **Backend (Done ✅)**
- [x] Database schema
- [x] Models & schemas
- [x] Services
- [x] API endpoints
- [x] Template formatting logic

### **Frontend (TODO ⚠️)**
- [ ] Remove Action Items/Decisions tabs
- [ ] Add template selector dropdown
- [ ] Update generate API call to include template_id
- [ ] Template management UI
- [ ] Template structure editor

### **Testing (TODO ⚠️)**
- [ ] Test template CRUD operations
- [ ] Test minutes generation with template
- [ ] Validate output matches template structure
- [ ] Test with different template types

---

## 🧪 Testing

### **1. Create Template**

```bash
curl -X POST "http://localhost:8000/api/v1/minutes-templates" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Custom Template",
    "code": "CUSTOM_001",
    "structure": {
      "sections": [...]
    }
  }'
```

### **2. Generate Minutes with Template**

```bash
curl -X POST "http://localhost:8000/api/v1/minutes/generate" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "...",
    "template_id": "...",
    "format": "markdown"
  }'
```

---

**Backend implementation completed! 🎉**

Frontend integration is the next step.

