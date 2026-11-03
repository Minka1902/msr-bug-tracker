ALTER TABLE project_card_types ADD COLUMN view_role_ids uuid[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT project_card_types_view_roles CHECK (
    view_role_ids = '{}' OR (create_role_ids <@ view_role_ids AND edit_role_ids <@ view_role_ids)
  );
