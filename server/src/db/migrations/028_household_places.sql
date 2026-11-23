CREATE TABLE household_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('medical', 'school', 'shops', 'food', 'services', 'government', 'family', 'friends', 'emergency', 'other')),
  contact_name text NOT NULL DEFAULT '' CHECK (char_length(contact_name) <= 120),
  phone text NOT NULL DEFAULT '' CHECK (char_length(phone) <= 40),
  phone_alt text NOT NULL DEFAULT '' CHECK (char_length(phone_alt) <= 40),
  email text NOT NULL DEFAULT '' CHECK (char_length(email) <= 254),
  website text NOT NULL DEFAULT '' CHECK (char_length(website) <= 2000),
  address text NOT NULL DEFAULT '' CHECK (char_length(address) <= 300),
  city text NOT NULL DEFAULT '' CHECK (char_length(city) <= 80),
  postal_code text NOT NULL DEFAULT '' CHECK (char_length(postal_code) <= 20),
  opening_hours text NOT NULL DEFAULT '' CHECK (char_length(opening_hours) <= 300),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 4000),
  is_favorite boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX household_places_project_idx ON household_places (project_id, lower(name));
