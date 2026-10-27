-- Dune Falcon booking: run this once in Supabase → SQL Editor
create extension if not exists pgcrypto;

create table if not exists packages (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  ref text not null,
  status text not null default 'new' check (status in ('new','contacted','confirmed','completed','cancelled')),
  source text,
  name text not null,
  phone text,
  email text,
  country text,
  pickup text,
  notes text,
  package_id text,
  package_name text,
  date date not null,
  slot text,
  slot_label text,
  slot_time text,
  adults int not null default 1,
  kids int not null default 0,
  addons text[] not null default '{}',
  total numeric not null default 0
);
create index if not exists leads_date_slot on leads (date, slot);
create index if not exists leads_created on leads (created_at desc);

-- Lock everything down: only the server (service role key) can read or write.
alter table packages enable row level security;
alter table settings enable row level security;
alter table leads enable row level security;

-- Starting data (edit it later in the admin dashboard)
insert into packages (id, data) values ('evening-shared', $json${"id":"evening-shared","name":"Evening Desert Safari","type":"Shared","price":150,"childPrice":120,"unit":"person","maxGuests":6,"duration":"6 hours","window":"15:00 – 21:30","slots":["evening"],"popular":true,"active":true,"order":1,"inclusions":["Hotel pickup & drop-off in a shared 4×4","30–40 min dune bashing","Sunset photo stop","Camel ride & sandboarding","Henna, Arabic coffee & dates","Tanoura, belly dance & fire show","BBQ buffet dinner, soft drinks & water"]}$json$::jsonb) on conflict (id) do nothing;
insert into packages (id, data) values ('evening-private', $json${"id":"evening-private","name":"Private Land Cruiser Safari","type":"Private","price":900,"childPrice":0,"unit":"vehicle","maxGuests":6,"duration":"6 hours","window":"Your pickup time","slots":["morning","evening"],"popular":false,"active":true,"order":2,"inclusions":["Whole Land Cruiser for your group (up to 6)","Driver waits on your timing","Everything in the Evening Safari","VIP majlis seating at camp","Priority BBQ service"]}$json$::jsonb) on conflict (id) do nothing;
insert into packages (id, data) values ('morning', $json${"id":"morning","name":"Morning Dune Bashing","type":"Shared","price":120,"childPrice":100,"unit":"person","maxGuests":6,"duration":"4 hours","window":"08:00 – 12:00","slots":["morning"],"popular":false,"active":true,"order":3,"inclusions":["Hotel pickup & drop-off","45 min dune bashing","Camel ride & sandboarding","Bottled water & refreshments"]}$json$::jsonb) on conflict (id) do nothing;
insert into packages (id, data) values ('overnight', $json${"id":"overnight","name":"Overnight Desert Camp","type":"Shared","price":350,"childPrice":280,"unit":"person","maxGuests":6,"duration":"18 hours","window":"15:00 – 09:00","slots":["evening"],"popular":false,"active":true,"order":4,"inclusions":["Everything in the Evening Safari","Sleep in a Bedouin tent","Breakfast at sunrise","Morning drop-off at your hotel"]}$json$::jsonb) on conflict (id) do nothing;
insert into settings (key, value) values ('schedule', $json${"openDays":[0,1,2,3,4,5,6],"cutoffHours":4,"blocked":[],"slots":[{"id":"morning","label":"Morning","time":"08:00","capacity":24},{"id":"evening","label":"Evening","time":"15:00","capacity":60}]}$json$::jsonb) on conflict (key) do nothing;
insert into settings (key, value) values ('business', $json${"whatsapp":"+971502341729","email":"dunefalcondubai@gmail.com","licence":"","currency":"AED","addons":[{"id":"quad","name":"Quad bike, 30 min","price":150,"unit":"person"},{"id":"buggy","name":"Dune buggy, 30 min (2-seat)","price":450,"unit":"booking"},{"id":"vip","name":"VIP majlis seating","price":50,"unit":"person"},{"id":"falcon","name":"Falcon photo","price":40,"unit":"person"},{"id":"cake","name":"Birthday cake at camp","price":120,"unit":"booking"}]}$json$::jsonb) on conflict (key) do nothing;
