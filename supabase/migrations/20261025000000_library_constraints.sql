-- One library row per saved passage and per author, per user.
create unique index library_items_passage_unique
  on public.library_items (user_id, passage_id) where kind = 'passage';
create unique index library_items_author_unique
  on public.library_items (user_id, ref) where kind = 'author';

-- Removing a passage from the library table removes it from users' libraries.
alter table public.library_items
  drop constraint library_items_passage_id_fkey,
  add constraint library_items_passage_id_fkey
    foreign key (passage_id) references public.passages (id) on delete cascade;
