export const visibleTo = (task: string, user: string) => `(
  ${task}.card_type_id IS NULL OR ${task}.assignee_id = ${user} OR ${task}.reporter_id = ${user}
  OR NOT EXISTS (
    SELECT 1 FROM project_card_types vct
    WHERE vct.id = ${task}.card_type_id AND vct.view_role_ids <> '{}'
      AND NOT EXISTS (
        SELECT 1 FROM project_members vm JOIN projects vp ON vp.id = vm.project_id
        WHERE vm.project_id = ${task}.project_id AND vm.user_id = ${user}
          AND (vm.role_id = ANY(vct.view_role_ids) OR vp.owner_id = ${user}))))`;
