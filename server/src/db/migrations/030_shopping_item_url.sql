ALTER TABLE shopping_items ADD COLUMN url text CHECK (url IS NULL OR char_length(url) <= 2000);
