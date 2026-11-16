-- Pega TODO esto en Supabase > SQL Editor > Run.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text unique,
  plan text not null default 'free',          -- free | basic | pro
  plan_expires_at timestamptz,                -- vigencia del plan de pago
  free_used int not null default 0,           -- PDFs gratis gastados (límite: 3)
  extra_credits int not null default 0,       -- PDFs extra pagados ($2.000 COP c/u)
  created_at timestamptz default now()
);
create table public.payments (                -- evita aplicar dos veces el mismo pago
  id text primary key, provider text, user_id uuid, kind text, created_at timestamptz default now()
);
alter table public.profiles enable row level security;
alter table public.payments enable row level security;
-- El usuario solo puede LEER su propio perfil. Nadie puede escribir desde el navegador.
create policy "ver mi perfil" on public.profiles for select using (auth.uid() = id);

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, email) values (new.id, lower(new.email)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Descuenta 1 PDF de forma atómica: plan vigente > gratis (3) > crédito extra
create function public.consume_pdf(uid uuid) returns text language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = uid for update;
  if not found then return 'none'; end if;
  if p.plan <> 'free' and p.plan_expires_at > now() then return 'plan'; end if;
  if p.free_used < 3 then update public.profiles set free_used = free_used + 1 where id = uid; return 'free'; end if;
  if p.extra_credits > 0 then update public.profiles set extra_credits = extra_credits - 1 where id = uid; return 'extra'; end if;
  return 'limit';
end $$;

-- Aplica un pago una sola vez: plan (+30 días) o 1 crédito extra
create function public.apply_payment(pid text, prov text, uid uuid, kind text) returns text language plpgsql security definer set search_path = public as $$
begin
  insert into public.payments (id, provider, user_id, kind) values (pid, prov, uid, kind) on conflict do nothing;
  if not found then return 'dup'; end if;
  if kind = 'extra' then
    update public.profiles set extra_credits = extra_credits + 1 where id = uid;
  else
    update public.profiles set plan = kind,
      plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + interval '30 days' where id = uid;
  end if;
  return 'ok';
end $$;

revoke execute on function public.consume_pdf(uuid) from public, anon, authenticated;
revoke execute on function public.apply_payment(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_pdf(uuid) to service_role;
grant execute on function public.apply_payment(text, text, uuid, text) to service_role;
