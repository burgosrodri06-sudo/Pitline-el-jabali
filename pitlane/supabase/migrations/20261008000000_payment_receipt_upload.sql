-- Gabriel: first receipt submission only. Rodrigo owns review/read policies.
-- Privileged server RPCs: user ID comes from verified getUser(), not the browser.
create table public.payment_receipt_attempts (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  reservation_id uuid not null references public.reservations(id),
  file_hash text not null check (file_hash ~ '^[a-f0-9]{64}$'),
  reference text not null check (char_length(reference) between 1 and 120),
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  object_path text not null unique,
  payment_id uuid unique references public.payments(id),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.payment_receipt_attempts enable row level security;
revoke all on public.payment_receipt_attempts from public,anon,authenticated,service_role;

-- Server validation cannot be bypassed by uploading arbitrary bytes via the SDK.
-- Restrictive policies compose with Rodrigo's SELECT policy without duplicating it.
create policy receipt_no_browser_insert on storage.objects as restrictive for insert
  to anon,authenticated with check (bucket_id <> 'payment-receipts');
create policy receipt_no_browser_update on storage.objects as restrictive for update
  to anon,authenticated using (bucket_id <> 'payment-receipts') with check (bucket_id <> 'payment-receipts');
create policy receipt_no_browser_delete on storage.objects as restrictive for delete
  to anon,authenticated using (bucket_id <> 'payment-receipts');

create function public.prepare_payment_receipt(p_user uuid,p_reservation uuid,p_key uuid,
  p_hash text,p_reference text,p_last4 text,p_finalize boolean default false) returns jsonb
language plpgsql security definer set search_path='' set row_security=off as $$
declare r public.reservations; s public.slots; a public.payment_receipt_attempts;
  pid uuid; v_now timestamptz; available integer;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'read_committed_required'; end if;
  if p_user is null or not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null)
    then raise exception 'receipt_auth_required'; end if;
  if p_key is null or p_hash is null or p_hash !~ '^[a-f0-9]{64}$'
    or p_reference is null or char_length(btrim(p_reference)) not between 1 and 120
    or p_last4 is null or p_last4 !~ '^[0-9]{4}$' or p_finalize is null then raise exception 'receipt_invalid_input'; end if;
  -- Authorization before revealing catalog/state; lock order slot -> reservation -> payment.
  select sl.* into s from public.slots sl join public.reservations rr on rr.slot_id=sl.id
    where rr.id=p_reservation and rr.user_id=p_user for update of sl;
  select * into r from public.reservations where id=p_reservation and user_id=p_user for update;
  if r.id is null then raise exception 'receipt_unavailable'; end if;
  perform 1 from public.payments where reservation_id=r.id order by id for update;
  select * into a from public.payment_receipt_attempts where id=p_key for update;
  if a.id is not null then
    if a.user_id<>p_user or a.reservation_id<>r.id or a.file_hash<>p_hash
      or a.reference<>btrim(p_reference) or a.last4<>p_last4 then raise exception 'receipt_idempotency_conflict'; end if;
    -- Recover lost finalize response even if expired or reviewed since then.
    if a.payment_id is not null then
      return jsonb_build_object('paymentId',a.payment_id,'submitted',true);
    end if;
  end if;
  if exists(select 1 from public.payments where reservation_id=r.id) then raise exception 'receipt_resubmission_blocked'; end if;
  v_now:=clock_timestamp();
  if r.channel<>'web' or r.status<>'pending_payment' or r.expires_at is null or r.expires_at<=v_now
    or s.starts_at<=v_now or s.status not in ('available','full')
    or not exists(select 1 from public.events where id=s.event_id and status='open')
    then raise exception 'receipt_expired_or_unavailable'; end if;
  -- The unexpired hold already consumes r.spots. No second subtraction/formula.
  select public.slot_available_spots(s.id) into available;
  if available is null or available<0 then raise exception 'receipt_capacity_unavailable'; end if;
  if not exists(select 1 from storage.buckets where id='payment-receipts' and not public)
    then raise exception 'receipt_bucket_unavailable'; end if;
  if a.id is null then
    if p_finalize then raise exception 'receipt_attempt_missing'; end if;
    if (select count(*) from public.payment_receipt_attempts where reservation_id=r.id)>=5 then raise exception 'receipt_attempt_limit'; end if;
    insert into public.payment_receipt_attempts(id,user_id,reservation_id,file_hash,reference,last4,object_path)
      values(p_key,p_user,r.id,p_hash,btrim(p_reference),p_last4,
        p_user::text||'/'||r.id::text||'/'||p_key::text||'.png') returning * into a;
  end if;
  if not p_finalize then return jsonb_build_object('objectPath',a.object_path,'submitted',false); end if;
  if not exists(select 1 from storage.objects where bucket_id='payment-receipts' and name=a.object_path)
    then raise exception 'receipt_object_missing'; end if;
  -- Recheck real time immediately before transition; never resurrect an expired hold.
  if r.expires_at<=clock_timestamp() or s.starts_at<=clock_timestamp() then raise exception 'receipt_expired_or_unavailable'; end if;
  insert into public.payments(reservation_id,amount,method,reference,last4,receipt_path,status,created_by)
    values(r.id,r.amount,'bank_transfer',a.reference,a.last4,a.object_path,'uploaded',p_user) returning id into pid;
  update public.reservations set status='payment_review' where id=r.id;
  update public.payment_receipt_attempts set payment_id=pid where id=a.id;
  return jsonb_build_object('paymentId',pid,'submitted',true);
end $$;
revoke all on function public.prepare_payment_receipt(uuid,uuid,uuid,text,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.prepare_payment_receipt(uuid,uuid,uuid,text,text,text,boolean) to service_role;
