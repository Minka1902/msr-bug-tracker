ALTER TABLE project_members ADD COLUMN is_main boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX project_members_one_main ON project_members (user_id) WHERE is_main;

UPDATE project_members m SET is_main = true
FROM (
  SELECT DISTINCT ON (pm.user_id) pm.project_id, pm.user_id
  FROM project_members pm JOIN projects p ON p.id = pm.project_id
  WHERE p.kind = 'household'
  ORDER BY pm.user_id, coalesce(pm.last_opened_at, pm.joined_at) DESC
) first
WHERE m.project_id = first.project_id AND m.user_id = first.user_id;
