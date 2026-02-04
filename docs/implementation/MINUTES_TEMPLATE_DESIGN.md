# 📋 Minutes Template System Design

## 📋 Overview

Hệ thống template biên bản họp cho phép:
- ✅ Lưu trữ các mẫu biên bản đã thiết kế
- ✅ Chọn template khi generate biên bản
- ✅ Chỉnh sửa template
- ✅ AI generate biên bản theo đúng cấu trúc template
- ✅ Đảm bảo output có đầy đủ các trường cần thiết

---

## 🗄️ Database Schema

### **minutes_template Table**

```sql
CREATE TABLE minutes_template (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Info
    name TEXT NOT NULL,                    -- Tên template (VD: "Biên bản Hội đồng Quản trị")
    code TEXT UNIQUE,                      -- Mã template (VD: "BOARD_MEETING")
    description TEXT,                      -- Mô tả template
    
    -- Template Structure (JSON)
    structure JSONB NOT NULL,              -- Cấu trúc template với các sections và fields
    sample_data JSONB,                     -- Dữ liệu mẫu để preview
    
    -- Usage
    meeting_types TEXT[],                  -- Các loại meeting áp dụng (VD: ['board', 'compliance'])
    is_default BOOLEAN DEFAULT FALSE,      -- Template mặc định
    is_active BOOLEAN DEFAULT TRUE,        -- Template đang active
    
    -- Metadata
    created_by UUID REFERENCES user_account(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES user_account(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Versioning (optional)
    version INTEGER DEFAULT 1,
    parent_template_id UUID REFERENCES minutes_template(id)  -- Template cha (nếu là version mới)
);

CREATE INDEX idx_template_code ON minutes_template(code);
CREATE INDEX idx_template_meeting_types ON minutes_template USING GIN(meeting_types);
CREATE INDEX idx_template_active ON minutes_template(is_active) WHERE is_active = TRUE;
```

### **Structure JSON Format**

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
          "label": "Ngày giờ họp",
          "type": "datetime",
          "required": true,
          "source": "meeting.start_time"
        },
        {
          "id": "location",
          "label": "Địa điểm",
          "type": "text",
          "required": false,
          "source": "meeting.location"
        }
      ]
    },
    {
      "id": "participants",
      "title": "THÀNH PHẦN THAM GIA",
      "order": 2,
      "required": true,
      "fields": [
        {
          "id": "participants_list",
          "label": "Danh sách người tham gia",
          "type": "array",
          "required": true,
          "source": "meeting.participants",
          "item_fields": ["name", "role", "status"]
        }
      ]
    },
    {
      "id": "agenda",
      "title": "CHƯƠNG TRÌNH HỌP",
      "order": 3,
      "required": true,
      "fields": [
        {
          "id": "agenda_items",
          "label": "Các nội dung thảo luận",
          "type": "array",
          "required": true,
          "source": "ai_generated",
          "structure": {
            "item_title": "text",
            "presenter": "text",
            "duration": "number",
            "discussion": "text"
          }
        }
      ]
    },
    {
      "id": "summary",
      "title": "TÓM TẮT CUỘC HỌP",
      "order": 4,
      "required": true,
      "fields": [
        {
          "id": "executive_summary",
          "label": "Tóm tắt điều hành",
          "type": "text",
          "required": true,
          "source": "ai_generated"
        },
        {
          "id": "key_points",
          "label": "Các điểm chính",
          "type": "array",
          "required": true,
          "source": "ai_generated"
        }
      ]
    },
    {
      "id": "decisions",
      "title": "CÁC QUYẾT ĐỊNH",
      "order": 5,
      "required": false,
      "fields": [
        {
          "id": "decisions_list",
          "label": "Danh sách quyết định",
          "type": "array",
          "required": false,
          "source": "ai_generated",
          "structure": {
            "decision": "text",
            "rationale": "text",
            "impact": "text",
            "responsible": "text"
          }
        }
      ]
    },
    {
      "id": "actions",
      "title": "HÀNH ĐỘNG/CÔNG VIỆC",
      "order": 6,
      "required": false,
      "fields": [
        {
          "id": "action_items",
          "label": "Danh sách công việc",
          "type": "array",
          "required": false,
          "source": "ai_generated",
          "structure": {
            "task": "text",
            "owner": "text",
            "due_date": "date",
            "priority": "text"
          }
        }
      ]
    },
    {
      "id": "risks",
      "title": "RỦI RO",
      "order": 7,
      "required": false,
      "fields": [
        {
          "id": "risks_list",
          "label": "Rủi ro đã nhận diện",
          "type": "array",
          "required": false,
          "source": "ai_generated",
          "structure": {
            "risk": "text",
            "severity": "text",
            "mitigation": "text"
          }
        }
      ]
    },
    {
      "id": "next_meeting",
      "title": "CUỘC HỌP TIẾP THEO",
      "order": 8,
      "required": false,
      "fields": [
        {
          "id": "next_meeting_date",
          "label": "Ngày giờ họp tiếp theo",
          "type": "datetime",
          "required": false,
          "source": "meeting.end_time"
        }
      ]
    },
    {
      "id": "signatures",
      "title": "CHỮ KÝ",
      "order": 9,
      "required": false,
      "fields": [
        {
          "id": "chairman_signature",
          "label": "Chủ tọa",
          "type": "signature",
          "required": false
        },
        {
          "id": "secretary_signature",
          "label": "Thư ký",
          "type": "signature",
          "required": false
        }
      ]
    }
  ],
  "formatting": {
    "style": "formal",
    "language": "vi",
    "date_format": "dd/mm/yyyy",
    "time_format": "HH:mm"
  }
}
```

---

## 📊 Template Examples

### **1. Template: Biên bản Hội đồng Quản trị**

```json
{
  "name": "Biên bản Hội đồng Quản trị",
  "code": "BOARD_MEETING",
  "meeting_types": ["board", "governance"],
  "structure": {
    "sections": [
      {"id": "header", "required": true},
      {"id": "participants", "required": true},
      {"id": "agenda", "required": true},
      {"id": "summary", "required": true},
      {"id": "decisions", "required": true},
      {"id": "actions", "required": false},
      {"id": "signatures", "required": true}
    ]
  }
}
```

### **2. Template: Biên bản Tuân thủ/Kiểm toán**

```json
{
  "name": "Biên bản Tuân thủ/Kiểm toán",
  "code": "COMPLIANCE_AUDIT",
  "meeting_types": ["compliance", "audit"],
  "structure": {
    "sections": [
      {"id": "header", "required": true},
      {"id": "participants", "required": true},
      {"id": "agenda", "required": true},
      {"id": "summary", "required": true},
      {"id": "risks", "required": true},  // Emphasis on risks
      {"id": "actions", "required": true},
      {"id": "compliance_notes", "required": true}  // Custom section
    ]
  }
}
```

### **3. Template: Biên bản Theo dõi Tiến độ**

```json
{
  "name": "Biên bản Theo dõi Tiến độ",
  "code": "PROGRESS_REVIEW",
  "meeting_types": ["progress", "status", "sprint"],
  "structure": {
    "sections": [
      {"id": "header", "required": true},
      {"id": "participants", "required": true},
      {"id": "agenda", "required": true},
      {"id": "summary", "required": true},
      {"id": "actions", "required": true},  // Emphasis on actions
      {"id": "metrics", "required": true},  // Custom section for KPIs
      {"id": "next_meeting", "required": true}
    ]
  }
}
```

---

## 🔧 API Design

### **Template CRUD**

```
GET    /api/v1/minutes-templates          # List templates
POST   /api/v1/minutes-templates          # Create template
GET    /api/v1/minutes-templates/{id}     # Get template
PUT    /api/v1/minutes-templates/{id}     # Update template
DELETE /api/v1/minutes-templates/{id}     # Delete template

GET    /api/v1/minutes-templates/default  # Get default template
POST   /api/v1/minutes-templates/{id}/set-default  # Set as default
```

### **Generate Minutes with Template**

```
POST /api/v1/minutes/generate
{
  "meeting_id": "...",
  "template_id": "...",  // Optional: use template
  "format": "markdown"
}
```

---

## 🤖 AI Generation Flow

### **Step 1: Load Template**

```python
template = get_template(template_id)
structure = template.structure
```

### **Step 2: Map Data Sources**

```python
# For each field in template:
for section in structure['sections']:
    for field in section['fields']:
        source = field['source']
        
        if source == 'meeting.title':
            value = meeting.title
        elif source == 'meeting.participants':
            value = meeting.participants
        elif source == 'ai_generated':
            # Generate with AI
            value = await ai_generate_field(field, context)
```

### **Step 3: Generate AI Fields**

```python
async def ai_generate_field(field, context):
    prompt = build_prompt(field, context)
    
    # Example for "executive_summary":
    prompt = f"""
    Dựa trên transcript cuộc họp sau, tạo tóm tắt điều hành:
    
    Transcript: {context['transcript']}
    
    Yêu cầu:
    - Tóm tắt ngắn gọn, súc tích
    - Nêu bật các điểm chính
    - Dùng ngôn ngữ trang trọng
    
    Format: {field['structure']}
    """
    
    result = await llm.generate(prompt)
    return parse_result(result, field['structure'])
```

### **Step 4: Format Output**

```python
def format_minutes_with_template(template, data):
    sections = template.structure['sections']
    output = []
    
    for section in sorted(sections, key=lambda x: x['order']):
        output.append(f"## {section['title']}")
        
        for field in section['fields']:
            value = data.get(field['id'])
            if value:
                output.append(format_field(field, value))
    
    return "\n".join(output)
```

---

## ✅ Validation

### **Template Validation**

1. **Structure Validation:**
   - Sections phải có `id`, `title`, `order`
   - Fields phải có `id`, `type`
   - Required fields phải có giá trị khi generate

2. **Output Validation:**
   - Kiểm tra tất cả required fields có giá trị
   - Validate format theo field type
   - Ensure all sections are present (if required)

---

## 🎯 Frontend Changes

### **1. Remove Action Items/Decisions Tabs**

Replace với:
- Template selector dropdown
- Template preview
- Generate button với template selected

### **2. Template Management UI**

- List templates
- Create/Edit template form
- Template structure editor (JSON editor)
- Preview template

---

**Design completed! 🎉**

Next: Implement database, API, and frontend.

