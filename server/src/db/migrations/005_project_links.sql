ALTER TABLE projects
  ADD COLUMN live_url text CHECK (live_url ~ '^https?://' AND length(live_url) <= 2048),
  ADD COLUMN repo_url text CHECK (repo_url ~ '^https?://' AND length(repo_url) <= 2048);
