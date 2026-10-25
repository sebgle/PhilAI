-- Editable entry titles. Null means "untitled": the UI shows "Entry #N".
alter table public.entries
  add column title text check (char_length(title) <= 120);
