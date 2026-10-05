-- public.is_admin(): true si el usuario actual tiene role = 'admin'.
-- security definer: lee profiles saltándose RLS, así se puede usar en políticas
-- de cualquier tabla (incluida profiles) sin recursión.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;
