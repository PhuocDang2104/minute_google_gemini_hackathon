# 📋 Minutes Template System - Status Report

## ✅ Đã hoàn thành (Completed)

### **Backend (100% ✅)**

1. **Database Schema**
   - ✅ `minutes_template` table đã tạo
   - ✅ Migration file: `infra/postgres/init/07_minutes_template.sql`
   - ✅ Default templates đã được seed

2. **Models & Schemas**
   - ✅ `backend/app/models/minutes_template.py` - SQLAlchemy model
   - ✅ `backend/app/schemas/minutes_template.py` - Pydantic schemas
   - ✅ `GenerateMinutesRequest` đã có `template_id` field

3. **Services**
   - ✅ `backend/app/services/template_service.py` - CRUD operations
   - ✅ `backend/app/services/template_formatter.py` - Template-based formatting
   - ✅ `minutes_service.py` đã integrate với template

4. **API Endpoints**
   - ✅ `backend/app/api/v1/endpoints/minutes_template.py`
   - ✅ Tất cả CRUD endpoints:
     - `GET /minutes-templates` - List templates
     - `GET /minutes-templates/default` - Get default
     - `GET /minutes-templates/{id}` - Get by ID
     - `POST /minutes-templates` - Create
     - `PUT /minutes-templates/{id}` - Update
     - `DELETE /minutes-templates/{id}` - Delete
     - `POST /minutes-templates/{id}/set-default` - Set default

### **Frontend - Core (80% ✅)**

1. **API Client**
   - ✅ `electron/src/renderer/lib/api/minutes_template.ts`
   - ✅ Đầy đủ methods: list, get, create, update, delete, setDefault

2. **Template Selector in Post-Meeting**
   - ✅ `PostMeetTabFireflies.tsx` đã có template selector dropdown
   - ✅ Load templates và default template
   - ✅ Select template khi generate minutes
   - ✅ Pass `template_id` vào API generate

---

## ❌ Còn thiếu (Missing)

### **Frontend - Template Management UI (0% ❌)**

1. **Template Management Page/Component**
   - ❌ Chưa có component để list templates
   - ❌ Chưa có component để create/edit template
   - ❌ Chưa có template structure editor (JSON editor hoặc visual builder)
   - ❌ Chưa có UI để preview template

2. **Routing**
   - ❌ Chưa có route cho template management
   - ❌ Chưa có link/navigation đến template management

3. **Integration**
   - ❌ Chưa có link trong Admin Console
   - ❌ Chưa có link trong Settings

---

## 📋 Cần làm (TODO)

### **Priority 1: Template Management UI**

#### **1.1. Tạo Template Management Page**

**File:** `electron/src/renderer/app/routes/TemplateManagement.tsx`

**Features:**
- List all templates (table/list view)
- Create new template button
- Edit template button
- Delete template button (with confirmation)
- Set default template button
- Filter by meeting_type, is_active
- Show template details (name, code, description, structure preview)

#### **1.2. Tạo Template Editor Component**

**File:** `electron/src/renderer/app/routes/Templates/TemplateEditor.tsx`

**Features:**
- Form fields: name, code, description, meeting_types
- Structure editor:
  - Option 1: JSON editor (Monaco Editor hoặc simple textarea với JSON validation)
  - Option 2: Visual builder (drag & drop sections/fields) - **Future enhancement**
- Preview template structure
- Save/Cancel buttons

#### **1.3. Add Route**

**File:** `electron/src/renderer/app/router/index.tsx`

```typescript
import TemplateManagement from '../routes/TemplateManagement'

// Add to routes:
{ path: 'templates', element: <TemplateManagement /> },
```

#### **1.4. Add Navigation Links**

**Option 1: In Admin Console**
- File: `electron/src/renderer/app/routes/AdminConsole.tsx`
- Add section card for "Template Management"

**Option 2: In Settings**
- File: `electron/src/renderer/app/routes/Settings.tsx`
- Add "Templates" tab/section

**Option 3: Standalone menu item**
- Add to sidebar navigation

---

## 🎯 Template Structure Format

Templates use JSON structure:

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
        },
        {
          "id": "meeting_date",
          "label": "Ngày họp",
          "type": "date",
          "required": true,
          "source": "meeting.start_time",
          "format": "DD/MM/YYYY"
        }
      ]
    },
    {
      "id": "summary",
      "title": "TÓM TẮT",
      "order": 2,
      "required": false,
      "fields": [
        {
          "id": "ai_summary",
          "label": "Tóm tắt AI",
          "type": "text",
          "required": false,
          "source": "ai_generated.summary"
        }
      ]
    }
  ]
}
```

---

## 🧪 Testing Checklist

### **Backend (Done ✅)**
- [x] Create template API
- [x] List templates API
- [x] Update template API
- [x] Delete template API
- [x] Set default template API
- [x] Generate minutes with template

### **Frontend (TODO ⚠️)**
- [ ] List templates UI
- [ ] Create template UI
- [ ] Edit template UI
- [ ] Delete template UI
- [ ] Set default template UI
- [ ] Template selector in Post-Meeting (✅ Done)
- [ ] Generate minutes with selected template (✅ Done)

---

## 📝 Recommendations

### **Quick Win: Simple JSON Editor**

For initial implementation, use a simple JSON textarea with validation:

```typescript
// Simple approach
<textarea
  value={JSON.stringify(structure, null, 2)}
  onChange={(e) => {
    try {
      const parsed = JSON.parse(e.target.value);
      setStructure(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError(err.message);
    }
  }}
/>
```

### **Future Enhancement: Visual Builder**

Later, can build a visual drag-and-drop editor for template structure (similar to form builders).

---

## 🚀 Next Steps

1. **Create `TemplateManagement.tsx`** - List/CRUD UI
2. **Create `TemplateEditor.tsx`** - Create/Edit form
3. **Add route** in router
4. **Add navigation** link (Admin/Settings)
5. **Test** full flow: Create → Use in Post-Meeting → Generate

---

**Backend: 100% Complete ✅**  
**Frontend Core: 80% Complete ✅**  
**Frontend Management UI: 0% Complete ❌**

