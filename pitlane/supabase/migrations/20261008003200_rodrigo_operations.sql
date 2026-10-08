-- Rodrigo: operations against the frozen schema in 20261005155117_schema_base.sql.
-- No service key. All mutations re-check roles and current state inside PostgreSQL.
alter table public.attendance add column first_ride_completed_by uuid references public.profiles(id);
alter table public.credits add column created_by uuid references public.profiles(id);
alter table public.reservations add column track_idempotency_key uuid;
create unique index operations_track_request on public.reservations(created_by, track_idempotency_key)
  where track_idempotency_key is not null;
create unique index operations_one_settled_payment on public.payments(reservation_id)
  where status in ('approved','reconciled');
alter table public.reservation_participants add constraint operations_participant_reservation unique(id,reservation_id);
alter table public.attendance add constraint operations_attendance_participant_fk
  foreign key(participant_id,reservation_id) references public.reservation_participants(id,reservation_id);
alter table public.attendance add constraint operations_attendance_consistent check (
  (not no_show or checked_in_at is null)
  and (checked_in_at is null) = (checked_in_by is null)
  and first_ride_completed = (first_ride_completed_at is not null)
  and (not first_ride_completed or (checked_in_at is not null and first_ride_completed_at >= checked_in_at))
);

create table public.operation_slot_closures (
  slot_id uuid primary key references public.slots(id),
  closed_at timestamptz not null default clock_timestamp(),
  closed_by uuid not null references public.profiles(id)
);
alter table public.operation_slot_closures enable row level security;
revoke all on public.operation_slot_closures from public,anon,authenticated;
grant select on public.operation_slot_closures to authenticated;
create policy operations_closures_read on public.operation_slot_closures for select to authenticated
 using (public.has_role(array['staff','payments','kre_admin','system_admin']));

revoke all on public.attendance,public.credits,public.payments,public.reservations,
 public.reservation_participants from public,anon,authenticated;
grant select on public.attendance,public.credits,public.payments,public.reservations,
 public.reservation_participants to authenticated;
create policy operations_reservations_read on public.reservations for select to authenticated
 using (user_id=auth.uid() or public.has_role(array['staff','payments','kre_admin','system_admin']));
create policy operations_participants_read on public.reservation_participants for select to authenticated
 using (exists(select 1 from public.reservations r where r.id=reservation_id));
create policy operations_attendance_read on public.attendance for select to authenticated
 using (exists(select 1 from public.reservations r where r.id=reservation_id));
create policy operations_payments_read on public.payments for select to authenticated
 using (public.has_role(array['payments','system_admin']) or exists(
   select 1 from public.reservations r where r.id=reservation_id and r.user_id=auth.uid()));
create policy operations_credits_read on public.credits for select to authenticated
 using (user_id=auth.uid() or public.has_role(array['payments','kre_admin','system_admin']));
create policy operations_slots_read on public.slots for select to authenticated
 using (public.has_role(array['staff','payments','kre_admin','system_admin']) or exists(
   select 1 from public.reservations r where r.slot_id=slots.id and r.user_id=auth.uid()));
-- Avoid an events -> slots -> events RLS recursion in historical owner reads.
create function public.operations_owns_event(p_event_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.slots s join public.reservations r on r.slot_id=s.id
 where s.event_id=p_event_id and r.user_id=auth.uid());
$$;
revoke all on function public.operations_owns_event(uuid) from public,anon;
grant execute on function public.operations_owns_event(uuid) to authenticated;
create policy operations_events_read on public.events for select to authenticated
 using (public.has_role(array['staff','payments','kre_admin','system_admin']) or public.operations_owns_event(id));
create policy operations_packages_read on public.packages for select to authenticated
 using (public.has_role(array['staff','payments','kre_admin','system_admin']) or exists(
   select 1 from public.reservations r where r.package_id=packages.id and r.user_id=auth.uid()));
create policy operations_receipt_read on storage.objects for select to authenticated
 using (bucket_id='payment-receipts' and exists (
   select 1 from public.payments p join public.reservations r on r.id=p.reservation_id
   where p.receipt_path=name and (r.user_id=auth.uid() or public.has_role(array['payments','system_admin']))
 ));

create function public.operations_require_role(p_roles text[]) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_role(p_roles) then
   raise exception using errcode='42501',message='operations_forbidden';
 end if;
end $$;

-- One capacity formula, preserving attendance/no-show and avoiding double subtraction
-- of track sales from the protected track allocation. All allocating writers lock slots.
create or replace function public.slot_available_spots(p_slot_id uuid) returns int
language sql stable security definer set search_path='' as $$
 select greatest(0,s.capacity - coalesce(sum(r.spots) filter(where r.channel='web'),0)::int
   - greatest(s.track_reserved_spots,coalesce(sum(r.spots) filter(where r.channel='track'),0)::int))
 from public.slots s left join public.reservations r on r.slot_id=s.id and (
   r.status in ('payment_review','paid','attended','no_show')
   or (r.status='pending_payment' and r.expires_at>statement_timestamp()))
 where s.id=p_slot_id group by s.id;
$$;

-- Defense in depth for all future reservation writers, including other modules.
create function public.operations_capacity_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare s public.slots; web_used int; track_used int; consumes boolean;
begin
 if current_setting('transaction_isolation')<>'read committed' then
   raise exception using errcode='25001',message='operations_read_committed_required';
 end if;
 if tg_op='UPDATE' and (new.slot_id,new.spots,new.channel) is distinct from (old.slot_id,old.spots,old.channel) then
   raise exception 'operations_immutable_allocation';
 end if;
 select * into strict s from public.slots where id=new.slot_id for update;
 consumes := new.status in ('payment_review','paid','attended','no_show')
   or (new.status='pending_payment' and new.expires_at>clock_timestamp());
 if consumes then
   select coalesce(sum(spots) filter(where channel='web'),0),coalesce(sum(spots) filter(where channel='track'),0)
   into web_used,track_used from public.reservations where slot_id=new.slot_id and id<>new.id and (
     status in ('payment_review','paid','attended','no_show') or (status='pending_payment' and expires_at>clock_timestamp()));
   if new.channel='web' then web_used:=web_used+new.spots; else track_used:=track_used+new.spots; end if;
   if web_used+track_used>s.capacity or (new.channel='web' and web_used+greatest(track_used,s.track_reserved_spots)>s.capacity) then
     raise exception 'operations_insufficient_capacity';
   end if;
 end if;
 return new;
end $$;
create trigger operations_capacity_guard before insert or update on public.reservations
 for each row execute function public.operations_capacity_guard();

create function public.operations_review_payment(p_payment_id uuid,p_action text,p_reason text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.payments; r public.reservations; s public.slots; rid uuid;
begin
 perform public.operations_require_role(array['payments','system_admin']);
 select reservation_id into rid from public.payments where id=p_payment_id;
 select s0.* into s from public.slots s0 join public.reservations r0 on r0.slot_id=s0.id where r0.id=rid for update of s0;
 select * into r from public.reservations where id=rid for update;
 select * into p from public.payments where id=p_payment_id for update;
 if p.id is null or p.method<>'bank_transfer' then raise exception 'operations_payment_unavailable'; end if;
 if p_action='reconcile' then
   if p.status='reconciled' then return r.id; end if;
   if p.status<>'approved' then raise exception 'operations_payment_not_approved'; end if;
   update public.payments set status='reconciled',reviewed_by=auth.uid(),reviewed_at=clock_timestamp() where id=p.id;
 elsif p_action in ('approve','reject') then
   if p_action='approve' and p.status in ('approved','reconciled') then return r.id; end if;
   if p.status<>'uploaded' or r.status<>'payment_review' then raise exception 'operations_payment_not_pending'; end if;
   if p_action='reject' then
     if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then raise exception 'operations_reason_required'; end if;
     update public.payments set status='rejected',rejection_reason=btrim(p_reason),reviewed_by=auth.uid(),reviewed_at=clock_timestamp() where id=p.id;
     update public.reservations set status=case when expires_at>clock_timestamp() then 'pending_payment'::public.reservation_status else 'expired'::public.reservation_status end where id=r.id;
   else
     if s.status='cancelled' or exists(select 1 from public.events where id=s.event_id and status='cancelled') then raise exception 'operations_slot_unavailable'; end if;
     if p.amount<>r.amount or p.receipt_path is null or p.reference is null or p.last4 is null
       or not exists(select 1 from storage.objects where bucket_id='payment-receipts' and name=p.receipt_path)
       then raise exception 'operations_payment_invalid'; end if;
     update public.payments set status='approved',reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),rejection_reason=null where id=p.id;
     update public.reservations set status='paid' where id=r.id;
   end if;
 else raise exception 'operations_invalid_action'; end if;
 insert into public.audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),'payment_'||p_action,'payments',p.id);
 return r.id;
end $$;

create function public.operations_check_in(p_slot_id uuid,p_lookup text,p_participant_id uuid default null) returns int
language plpgsql security definer set search_path='' as $$
declare s public.slots; r public.reservations; n int;
begin
 perform public.operations_require_role(array['staff','kre_admin','system_admin']);
 select * into s from public.slots where id=p_slot_id for update;
 if s.id is null or s.status='cancelled' or clock_timestamp()>s.ends_at
   or (s.starts_at at time zone 'America/El_Salvador')::date<>(clock_timestamp() at time zone 'America/El_Salvador')::date
   or exists(select 1 from public.operation_slot_closures where slot_id=s.id)
   or exists(select 1 from public.events where id=s.event_id and status='cancelled') then raise exception 'operations_slot_unavailable'; end if;
 select * into r from public.reservations where slot_id=s.id and
   (code=upper(btrim(p_lookup)) or qr_token::text=lower(replace(btrim(p_lookup),'pitlane:qr:',''))) for update;
 if r.id is null or r.status not in ('paid','attended') or not exists(
   select 1 from public.payments where reservation_id=r.id and status in ('approved','reconciled') and amount=r.amount
 ) then raise exception 'operations_reservation_not_paid'; end if;
 if p_participant_id is not null and not exists(select 1 from public.reservation_participants where id=p_participant_id and reservation_id=r.id) then raise exception 'operations_participant_invalid'; end if;
 if (select count(*) from public.reservation_participants where reservation_id=r.id)<>r.spots then raise exception 'operations_participant_invalid'; end if;
 insert into public.attendance(participant_id,reservation_id,checked_in_at,checked_in_by)
   select id,r.id,clock_timestamp(),auth.uid() from public.reservation_participants
   where reservation_id=r.id and (p_participant_id is null or id=p_participant_id)
   on conflict(participant_id) do nothing;
 get diagnostics n=row_count;
 update public.reservations set status='attended' where id=r.id;
 insert into public.audit_logs(actor_id,action,entity,entity_id,data)
   values(auth.uid(),'check_in','reservations',r.id,jsonb_build_object('new_participants',n));
 return n;
end $$;

create function public.operations_complete_ride(p_participant_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.attendance; r public.reservations; s public.slots;
begin
 perform public.operations_require_role(array['staff','kre_admin','system_admin']);
 select s0.* into s from public.slots s0 join public.reservations r0 on r0.slot_id=s0.id
 join public.reservation_participants p on p.reservation_id=r0.id where p.id=p_participant_id for update of s0;
 select r0.* into r from public.reservations r0 join public.reservation_participants p on p.reservation_id=r0.id where p.id=p_participant_id for update of r0;
 select * into a from public.attendance where participant_id=p_participant_id for update;
 if a.id is null or a.checked_in_at is null or a.no_show or r.status not in ('paid','attended')
   or s.ends_at>clock_timestamp() or s.status='cancelled' then raise exception 'operations_ride_not_ready'; end if;
 if a.first_ride_completed then return; end if;
 update public.attendance set first_ride_completed=true,first_ride_completed_at=clock_timestamp(),first_ride_completed_by=auth.uid() where id=a.id;
 insert into public.audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),'first_ride_completed','reservation_participants',p_participant_id);
end $$;

create function public.operations_close_slot(p_slot_id uuid) returns int
language plpgsql security definer set search_path='' as $$
declare s public.slots; n int;
begin
 perform public.operations_require_role(array['staff','kre_admin','system_admin']);
 select * into s from public.slots where id=p_slot_id for update;
 if s.id is null or s.ends_at>clock_timestamp() or s.status='cancelled' then raise exception 'operations_slot_not_finished'; end if;
 if exists(select 1 from public.operation_slot_closures where slot_id=s.id) then return 0; end if;
 insert into public.attendance(participant_id,reservation_id,no_show)
   select p.id,r.id,true from public.reservation_participants p join public.reservations r on r.id=p.reservation_id
   where r.slot_id=s.id and r.status in ('paid','attended') on conflict(participant_id) do nothing;
 get diagnostics n=row_count;
 update public.reservations r set status='no_show' where slot_id=s.id and status in ('paid','attended')
   and not exists(select 1 from public.attendance a where a.reservation_id=r.id and a.checked_in_at is not null);
 update public.slots set status='closed' where id=s.id;
 insert into public.operation_slot_closures(slot_id,closed_by) values(s.id,auth.uid());
 insert into public.audit_logs(actor_id,action,entity,entity_id,data) values(auth.uid(),'close_slot','slots',s.id,jsonb_build_object('no_shows',n));
 return n;
end $$;

create function public.operations_track_sale(p_slot_id uuid,p_package_id uuid,p_name text,p_request_id uuid,p_first_participant_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.slots; e public.events; p public.packages; r public.reservations; first_p public.reservation_participants;
 used int; v_now timestamptz; owner_id uuid;
begin
 perform public.operations_require_role(array['staff','kre_admin','system_admin']);
 if p_request_id is null or p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'operations_invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_request_id::text,0));
 select * into r from public.reservations where created_by=auth.uid() and track_idempotency_key=p_request_id;
 if found then
   if r.slot_id<>p_slot_id or r.package_id<>p_package_id or not exists(select 1 from public.reservation_participants
     where reservation_id=r.id and full_name=btrim(p_name) and first_ride_participant_id is not distinct from p_first_participant_id)
     then raise exception 'operations_idempotency_conflict'; end if;
   return r.id;
 end if;
 -- Match the shared writer protocol: slot -> event -> package.
 select * into s from public.slots where id=p_slot_id for update;
 select * into e from public.events where id=s.event_id for share;
 select * into p from public.packages where id=p_package_id for share;
 v_now:=clock_timestamp();
 if s.id is null or e.status<>'open' or s.status not in ('available','full') or s.starts_at<=v_now
   or (s.starts_at at time zone 'America/El_Salvador')::date<>(v_now at time zone 'America/El_Salvador')::date
   or exists(select 1 from public.operation_slot_closures where slot_id=s.id) then raise exception 'operations_slot_unavailable'; end if;
 if p.id is null or not p.active or p.spots<>1 or p.duration_minutes<>10
   or p.valid_from>e.date or p.valid_to<e.date then raise exception 'operations_package_unavailable'; end if;
 if p.eligibility='requires_first_ride' then
   select rp.* into first_p from public.reservation_participants rp where rp.id=p_first_participant_id for share;
   if first_p.id is null or first_p.first_ride_participant_id is not null or first_p.full_name<>btrim(p_name)
     or not exists(select 1 from public.attendance a join public.reservations fr on fr.id=a.reservation_id
       where a.participant_id=first_p.id and a.checked_in_at is not null and a.first_ride_completed and not a.no_show
       and fr.status in ('paid','attended')) then raise exception 'operations_first_ride_required'; end if;
   select user_id into owner_id from public.reservations where id=first_p.reservation_id;
 elsif p_first_participant_id is not null then raise exception 'operations_invalid_input'; end if;
 select coalesce(sum(spots),0) into used from public.reservations where slot_id=s.id and (
   status in ('payment_review','paid','attended','no_show') or (status='pending_payment' and expires_at>v_now));
 if used+p.spots>s.capacity then raise exception 'operations_insufficient_capacity'; end if;
 insert into public.reservations(user_id,slot_id,package_id,spots,amount,status,channel,created_by,track_idempotency_key)
 values(owner_id,s.id,p.id,p.spots,p.price,'paid','track',auth.uid(),p_request_id) returning * into r;
 insert into public.reservation_participants(reservation_id,full_name,is_holder,first_ride_participant_id)
 values(r.id,btrim(p_name),true,p_first_participant_id);
 insert into public.payments(reservation_id,amount,method,status,created_by,reviewed_by,reviewed_at)
 values(r.id,p.price,'track_cash','approved',auth.uid(),auth.uid(),v_now);
 insert into public.audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),'track_sale','reservations',r.id);
 return r.id;
end $$;

create function public.operations_create_credit(p_reservation_id uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare r public.reservations; s public.slots; paid numeric; issued numeric; cid uuid;
begin
 perform public.operations_require_role(array['kre_admin','system_admin']);
 if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then raise exception 'operations_reason_required'; end if;
 select s0.* into s from public.slots s0 join public.reservations r0 on r0.slot_id=s0.id where r0.id=p_reservation_id for update of s0;
 select * into r from public.reservations where id=p_reservation_id for update;
 if r.id is null or r.user_id is null or r.status not in ('paid','attended','no_show','cancelled') then raise exception 'operations_credit_unavailable'; end if;
 select coalesce(sum(amount),0) into paid from public.payments where reservation_id=r.id and status in ('approved','reconciled') and method<>'credit';
 select coalesce(sum(amount),0) into issued from public.credits where origin_reservation_id=r.id;
 if paid<=issued then raise exception 'operations_credit_exhausted'; end if;
 insert into public.credits(user_id,origin_reservation_id,amount,reason,created_by) values(r.user_id,r.id,paid-issued,btrim(p_reason),auth.uid()) returning id into cid;
 update public.reservations set status='cancelled' where id=r.id;
 insert into public.audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),'issue_credit','credits',cid);
 return cid;
end $$;

-- Reports exclude sensitive bank reference/last4/receipt data for KRE admins.
create function public.operations_report(p_from date,p_to date,p_package_id uuid default null,p_method public.payment_method default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.operations_require_role(array['payments','kre_admin','system_admin']);
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'operations_invalid_range'; end if;
 with selected_slots as (
  select s.* from public.slots s join public.events e on e.id=s.event_id where e.date between p_from and p_to
 ), selected_reservations as (
  select r.* from public.reservations r join selected_slots s on s.id=r.slot_id
  where (p_package_id is null or r.package_id=p_package_id) and (p_method is null or exists(
    select 1 from public.payments p where p.reservation_id=r.id and p.method=p_method and p.status in ('approved','reconciled')))
 ) select jsonb_build_object(
 'slots',coalesce((select jsonb_agg(jsonb_build_object('id',id,'capacity',capacity)) from selected_slots),'[]'),
 'reservations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'userId',user_id,'slotId',slot_id,'packageId',package_id,'status',status,'spotsRequired',spots)) from selected_reservations),'[]'),
 'participants',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'reservationId',p.reservation_id,'checkedIn',a.checked_in_at is not null,'noShow',coalesce(a.no_show,false))) from public.reservation_participants p join selected_reservations r on r.id=p.reservation_id left join public.attendance a on a.participant_id=p.id),'[]'),
 'payments',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'reservationId',p.reservation_id,'status',p.status,'amountCents',(p.amount*100)::bigint,'isTrackCash',p.method='track_cash')) from public.payments p join selected_reservations r on r.id=p.reservation_id where p.method<>'credit' and (p_method is null or p.method=p_method)),'[]'),
 'credits',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'reservationId',c.origin_reservation_id,'amountCents',(c.amount*100)::bigint)) from public.credits c join selected_reservations r on r.id=c.origin_reservation_id),'[]')
 ) into result;
 return result;
end $$;

create function public.operations_track_availability(p_slot_id uuid) returns int
language plpgsql stable security definer set search_path='' as $$
declare result int;
begin
 perform public.operations_require_role(array['staff','kre_admin','system_admin']);
 select greatest(0,s.capacity-coalesce(sum(r.spots),0)::int) into result from public.slots s
 left join public.reservations r on r.slot_id=s.id and (r.status in ('payment_review','paid','attended','no_show')
 or (r.status='pending_payment' and r.expires_at>statement_timestamp())) where s.id=p_slot_id group by s.id;
 return result;
end $$;

revoke all on function public.operations_require_role(text[]),public.operations_capacity_guard() from public,anon,authenticated;
revoke all on function public.operations_review_payment(uuid,text,text),public.operations_check_in(uuid,text,uuid),
 public.operations_complete_ride(uuid),public.operations_close_slot(uuid),public.operations_track_sale(uuid,uuid,text,uuid,uuid),
 public.operations_create_credit(uuid,text),public.operations_report(date,date,uuid,public.payment_method),public.operations_track_availability(uuid) from public,anon;
grant execute on function public.operations_review_payment(uuid,text,text),public.operations_check_in(uuid,text,uuid),
 public.operations_complete_ride(uuid),public.operations_close_slot(uuid),public.operations_track_sale(uuid,uuid,text,uuid,uuid),
 public.operations_create_credit(uuid,text),public.operations_report(date,date,uuid,public.payment_method),public.operations_track_availability(uuid) to authenticated;
