-- ============================================================
-- PERSIAPAN SUPABASE AUTH + ROLE (AMAN / BELUM MENGUBAH AKSES APP)
-- LiveStockConsumable
-- ============================================================
-- File ini adalah TAHAP PERSIAPAN sesuai pilihan "siapkan mode Auth dahulu".
-- Bagian A boleh dijalankan: hanya menambah profiles + trigger akun baru.
-- Bagian B JANGAN dijalankan sebelum frontend dan proxy sudah memakai JWT user,
-- karena aplikasi sekarang masih memakai akses anon melalui /api/supabase.

-- ===== BAGIAN A: AMAN UNTUK PERSIAPAN =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'viewer' check (role in ('admin','operator','viewer','approver')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "User membaca profil sendiri" on public.profiles;
create policy "User membaca profil sendiri"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Setelah membuat akun admin di Authentication > Users, ubah role-nya:
-- update public.profiles set role = 'admin' where email = 'EMAIL_ADMIN_ANDA';

-- Helper role untuk tahap aktivasi mendatang.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles
  where id = auth.uid() and active = true
  limit 1;
$$;

-- ============================================================
-- BAGIAN B: TEMPLATE AKTIVASI — JANGAN JALANKAN SEKARANG
-- ============================================================
-- Ketika frontend/proxy sudah mengirim JWT Supabase Auth, kebijakan berikut
-- dapat diaktifkan secara bertahap. Jangan menghapus policy akses lama sebelum
-- pengujian login admin/operator berhasil.

/*
-- Contoh hak akses:
-- viewer    : SELECT
-- operator  : SELECT + INSERT transaksi
-- approver  : SELECT + UPDATE transaksi/opname
-- admin     : seluruh operasi

alter table public.master_barang enable row level security;
alter table public.log_transaksi enable row level security;
alter table public.gerai enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.po_deliveries enable row level security;
alter table public.email_settings enable row level security;

-- Baca data untuk seluruh user aktif yang sudah login.
create policy "Authenticated read master" on public.master_barang
for select to authenticated using (public.current_user_role() is not null);
create policy "Authenticated read logs" on public.log_transaksi
for select to authenticated using (public.current_user_role() is not null);

-- Operator/admin dapat membuat transaksi.
create policy "Operator insert logs" on public.log_transaksi
for insert to authenticated
with check (public.current_user_role() in ('admin','operator'));

-- Hanya admin dapat mengubah/menghapus master.
create policy "Admin manage master" on public.master_barang
for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

-- Tambahkan policy terpisah untuk gerai, PO, penerimaan, dan email_settings
-- setelah seluruh skenario diuji di Vercel Preview.
*/
