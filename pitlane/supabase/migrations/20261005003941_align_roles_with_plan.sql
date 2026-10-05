-- Alinea profiles.role con los 5 roles del plan:
-- pilot, staff, payments, kre_admin, system_admin.

-- 1. Roles: quitar el check viejo, convertir valores y poner el check nuevo.
alter table public.profiles drop constraint profiles_role_check;

update public.profiles set role = 'pilot' where role = 'cliente';
update public.profiles set role = 'system_admin' where role = 'admin';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('pilot', 'staff', 'payments', 'kre_admin', 'system_admin'));

alter table public.profiles alter column role set default 'pilot';

-- handle_new_user() no se toca: solo inserta id, full_name y phone, así que el
-- role siempre sale del default ('pilot') y nunca de los metadatos del signup.

-- 2. Funciones para usar en código y en políticas RLS.
-- security definer: leen profiles saltándose RLS, así no hay recursión.
create function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create function public.has_role(roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = any (roles)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role(array['kre_admin', 'system_admin']);
$$;

revoke execute on function public.get_my_role() from public;
revoke execute on function public.has_role(text[]) from public;
grant execute on function public.get_my_role() to authenticated, anon;
grant execute on function public.has_role(text[]) to authenticated, anon;

-- 3. Políticas nuevas en profiles.
create policy "El personal lee todos los perfiles"
  on public.profiles for select
  to authenticated
  using ((select public.has_role(array['staff', 'payments', 'kre_admin', 'system_admin'])));

create policy "system_admin actualiza cualquier perfil"
  on public.profiles for update
  to authenticated
  using ((select public.has_role(array['system_admin'])))
  with check ((select public.has_role(array['system_admin'])));

-- Para que system_admin pueda cambiar roles, authenticated necesita permiso
-- sobre la columna role. Quién puede usarlo lo decide el trigger de abajo.
grant update (role) on public.profiles to authenticated;

-- 4. Nadie cambia su propio role; solo system_admin cambia el de otros.
-- Sin usuario (SQL Editor del dashboard) sí se permite, para nombrar admins.
create function public.protect_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    if old.id = auth.uid() then
      raise exception 'No puedes cambiar tu propio rol.';
    end if;
    if not public.has_role(array['system_admin']) then
      raise exception 'Solo system_admin puede cambiar roles.';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_role_change
  before update on public.profiles
  for each row execute function public.protect_role_change();
