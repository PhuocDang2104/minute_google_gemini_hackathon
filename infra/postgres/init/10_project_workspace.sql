-- ============================================
-- Project workspace enhancements (folder-like grouping)
-- ============================================

-- Ensure project has rich metadata
ALTER TABLE project
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS objective TEXT,
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES department(id),
    ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES user_account(id),
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure project code uniqueness (optional)
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_code_unique
ON project(code)
WHERE code IS NOT NULL;

-- Project membership table
CREATE TABLE IF NOT EXISTS project_member (
    project_id UUID REFERENCES project(id) ON DELETE CASCADE,
    user_id UUID REFERENCES user_account(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member', -- owner / member / guest
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_member_user ON project_member(user_id);

-- Ensure project_id linkage exists on related tables
ALTER TABLE meeting
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id);

ALTER TABLE action_item
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id);

ALTER TABLE document
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES project(id);

ALTER TABLE knowledge_document
    ADD COLUMN IF NOT EXISTS project_id UUID;

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_project_owner ON project(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_department ON project(department_id);
CREATE INDEX IF NOT EXISTS idx_meeting_project ON meeting(project_id);
CREATE INDEX IF NOT EXISTS idx_action_item_project ON action_item(project_id);
CREATE INDEX IF NOT EXISTS idx_document_project ON document(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_document_project ON knowledge_document(project_id);
