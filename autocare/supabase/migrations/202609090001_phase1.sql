-- Phase 1: Customer, Manager and Administrator. Service Advisor UI/actions are held.
-- Apply to a new Supabase project using `supabase db push` after review.
begin;
create table public.tenants (id uuid primary key default gen_random_uuid(), name text not null, open_registration boolean not null default false);
create table public.branches (id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),name text not null,unique(tenant_id,id));
create table public.memberships (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,user_id uuid not null references auth.users(id),name text not null,role text not null check(role in ('customer','manager','advisor','administrator')),active boolean not null default true,foreign key(tenant_id,branch_id) references public.branches(tenant_id,id),unique(tenant_id,branch_id,user_id));
create table public.customers (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,user_id uuid not null references auth.users(id),name text not null,email text not null,phone text not null default '',advisor_id uuid references auth.users(id),last_visit date,marketing_consent boolean not null default false,consent_at timestamptz not null default now(),policy_version text not null default '1.0',foreign key(tenant_id,branch_id) references public.branches(tenant_id,id),unique(tenant_id,branch_id,id),unique(tenant_id,branch_id,user_id));
create table public.vehicles (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,customer_id uuid not null,registration text not null,model text not null,year integer not null check(year between 1980 and 2100),mileage integer not null check(mileage>=0),next_service integer not null default 0,health integer not null default 0 check(health between 0 and 100),verified boolean not null default false,foreign key(tenant_id,branch_id,customer_id) references public.customers(tenant_id,branch_id,id),unique(tenant_id,branch_id,id));
create table public.appointments (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,customer_id uuid not null,vehicle_id uuid not null,advisor_id uuid references auth.users(id),service text not null,date date not null,time time not null,status text not null default 'Booked' check(status in ('Booked','Confirmed','Arrived','In Service','Ready','Completed','Cancelled','No-show')),notes text not null default '',updated_at timestamptz not null default now(),foreign key(tenant_id,branch_id,customer_id) references public.customers(tenant_id,branch_id,id),foreign key(tenant_id,branch_id,vehicle_id) references public.vehicles(tenant_id,branch_id,id),unique(tenant_id,branch_id,id));
create table public.feedback (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,customer_id uuid not null,appointment_id uuid not null unique,rating integer not null check(rating between 1 and 5),comments text not null default '',contact_requested boolean not null default false,created_at timestamptz not null default now(),foreign key(tenant_id,branch_id,customer_id) references public.customers(tenant_id,branch_id,id),foreign key(tenant_id,branch_id,appointment_id) references public.appointments(tenant_id,branch_id,id));
create table public.recovery_cases (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,customer_id uuid not null,advisor_id uuid references auth.users(id),appointment_id uuid not null,rating integer not null check(rating between 1 and 5),comments text not null,status text not null default 'Open' check(status in ('Open','In progress','Resolved')),due_at timestamptz not null,contact_log text not null default '',outcome text not null default '',created_at timestamptz not null default now(),foreign key(tenant_id,branch_id,customer_id) references public.customers(tenant_id,branch_id,id),foreign key(tenant_id,branch_id,appointment_id) references public.appointments(tenant_id,branch_id,id),check(status<>'Resolved' or (length(trim(outcome))>0 and length(trim(contact_log))>0)));
create table public.campaigns (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,title text not null,segment text not null check(segment in ('Active','Due','At risk','Lapsed','All eligible')),budget_sen bigint not null check(budget_sen>=0),status text not null default 'Draft' check(status in ('Draft','Approved')),starts_on date not null,ends_on date not null,description text not null,foreign key(tenant_id,branch_id) references public.branches(tenant_id,id),check(ends_on>=starts_on));
create table public.adjustments (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,customer_id uuid not null,points integer not null check(points<>0 and abs(points)<=100000),reason text not null check(length(trim(reason))>0),requested_by uuid not null references auth.users(id),approved_by uuid references auth.users(id),status text not null default 'Pending' check(status in ('Pending','Approved','Posted')),foreign key(tenant_id,branch_id,customer_id) references public.customers(tenant_id,branch_id,id),check(approved_by is null or approved_by<>requested_by));
create table public.loyalty_entries (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,customer_id uuid not null,points integer not null,reason text not null,reference text not null,created_at timestamptz not null default now(),foreign key(tenant_id,branch_id,customer_id) references public.customers(tenant_id,branch_id,id),unique(tenant_id,reference));
create table public.settings (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,slot_minutes integer not null default 90 check(slot_minutes between 15 and 240),lead_hours integer not null default 2 check(lead_hours between 0 and 720),cancel_hours integer not null default 24 check(cancel_hours between 0 and 720),capacity integer not null default 4 check(capacity between 1 and 50),lapse_days integer not null default 210,at_risk_days integer not null default 150,recovery_hours integer not null default 24 check(recovery_hours between 1 and 720),low_rating integer not null default 3 check(low_rating between 1 and 5),adjustment_threshold integer not null default 500 check(adjustment_threshold>0),reward_points integer not null default 1250 check(reward_points>0),reward_value_sen bigint not null default 5000 check(reward_value_sen>0),tier_points integer not null default 4000 check(tier_points>0),points_per_rm integer not null default 1 check(points_per_rm>0),points_expiry_days integer not null default 365 check(points_expiry_days>0),promotion_limit_sen bigint not null default 100000 check(promotion_limit_sen>0),dealer_name text not null,closed_dates date[] not null default '{}',foreign key(tenant_id,branch_id) references public.branches(tenant_id,id),unique(tenant_id,branch_id),check(lapse_days>at_risk_days and at_risk_days>0));
create table public.audit_events (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,actor_id uuid not null references auth.users(id),action text not null,entity_id uuid not null,reason text not null,created_at timestamptz not null default now(),before_data jsonb,after_data jsonb,foreign key(tenant_id,branch_id) references public.branches(tenant_id,id));
create table public.notifications (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,customer_id uuid not null,category text not null check(category in ('Transactional','Marketing')),title text not null,body text not null,created_at timestamptz not null default now(),foreign key(tenant_id,branch_id,customer_id) references public.customers(tenant_id,branch_id,id));
create table public.inspections (id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,customer_id uuid not null,vehicle_id uuid not null,advisor_id uuid not null references auth.users(id),battery text not null,tyres text not null,brakes text not null,oil text not null,score integer not null check(score between 0 and 100),version integer not null,created_at timestamptz not null default now(),foreign key(tenant_id,branch_id,customer_id) references public.customers(tenant_id,branch_id,id),foreign key(tenant_id,branch_id,vehicle_id) references public.vehicles(tenant_id,branch_id,id));
-- Security helpers derive authority only from protected membership rows, never user metadata.
create function public.workspace_role(t uuid,b uuid) returns text language sql stable security definer set search_path='' as $$ select role from public.memberships where tenant_id=t and branch_id=b and user_id=auth.uid() and active $$;
create function public.customer_visible(t uuid,b uuid,c uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.customers x where x.id=c and x.tenant_id=t and x.branch_id=b and (public.workspace_role(t,b) in ('manager','administrator') or (public.workspace_role(t,b)='customer' and x.user_id=auth.uid()))) $$;
revoke all on function public.workspace_role(uuid,uuid),public.customer_visible(uuid,uuid,uuid) from public;
grant execute on function public.workspace_role(uuid,uuid),public.customer_visible(uuid,uuid,uuid) to authenticated;
-- SELECT only. All writes pass through phase1_action or trusted provisioning/imports.
do $$ declare tbl text;begin
 foreach tbl in array array['tenants','branches','memberships','customers','vehicles','appointments','feedback','recovery_cases','campaigns','adjustments','loyalty_entries','settings','audit_events','notifications','inspections'] loop
 execute format('alter table public.%I enable row level security',tbl);
 execute format('revoke all on public.%I from anon, authenticated',tbl);
 execute format('grant select on public.%I to authenticated',tbl);
 end loop;
end $$;
create policy member_read on public.memberships for select to authenticated using(public.workspace_role(tenant_id,branch_id) in ('manager','administrator') or (user_id=auth.uid()));
create policy customer_read on public.customers for select to authenticated using(public.customer_visible(tenant_id,branch_id,id));
create policy vehicle_read on public.vehicles for select to authenticated using(public.customer_visible(tenant_id,branch_id,customer_id));
create policy appointment_read on public.appointments for select to authenticated using(public.customer_visible(tenant_id,branch_id,customer_id));
create policy feedback_read on public.feedback for select to authenticated using(public.customer_visible(tenant_id,branch_id,customer_id));
create policy recovery_read on public.recovery_cases for select to authenticated using(public.workspace_role(tenant_id,branch_id) in ('manager','administrator'));
create policy campaign_read on public.campaigns for select to authenticated using(public.workspace_role(tenant_id,branch_id) in ('manager','administrator') or (public.workspace_role(tenant_id,branch_id)='customer' and status='Approved'));
create policy adjustment_read on public.adjustments for select to authenticated using(public.workspace_role(tenant_id,branch_id) in ('manager','administrator'));
create policy ledger_read on public.loyalty_entries for select to authenticated using(public.customer_visible(tenant_id,branch_id,customer_id));
create policy settings_read on public.settings for select to authenticated using(public.workspace_role(tenant_id,branch_id) in ('customer','manager','administrator'));
create policy audit_read on public.audit_events for select to authenticated using(public.workspace_role(tenant_id,branch_id)='administrator' or (public.workspace_role(tenant_id,branch_id)='manager' and action not in ('member.update','settings.update','vehicle.verify')));
create policy notification_read on public.notifications for select to authenticated using(public.customer_visible(tenant_id,branch_id,customer_id));
create policy inspection_read on public.inspections for select to authenticated using(public.customer_visible(tenant_id,branch_id,customer_id));
create index appointments_slot on public.appointments(tenant_id,branch_id,date,time);
create index customers_user on public.customers(user_id,tenant_id,branch_id);
create index loyalty_customer on public.loyalty_entries(tenant_id,branch_id,customer_id);
create index recovery_due on public.recovery_cases(tenant_id,branch_id,status,due_at);
create index audit_scope on public.audit_events(tenant_id,branch_id,created_at);
-- Registration creates only a customer, after email authentication. No client-supplied role.
create function public.enrol_customer(p_tenant uuid,p_branch uuid) returns void language plpgsql security definer set search_path='' as $$
declare u auth.users%rowtype; cid uuid;begin
 if auth.uid() is null then raise exception 'Sign in after email verification';end if;
 select * into u from auth.users where id=auth.uid();
 if u.email_confirmed_at is null then raise exception 'Verify your email first';end if;
 perform 1 from public.tenants t join public.branches b on b.tenant_id=t.id where t.id=p_tenant and b.id=p_branch and t.open_registration;
 if not found then raise exception 'Customer registration is not enabled for this branch';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_tenant::text||p_branch::text,0));
 if exists(select 1 from public.memberships where tenant_id=p_tenant and branch_id=p_branch and user_id=auth.uid()) then raise exception 'Membership already exists; contact your administrator if access is suspended';end if;
 insert into public.memberships(tenant_id,branch_id,user_id,name,role) values(p_tenant,p_branch,auth.uid(),coalesce(nullif(u.raw_user_meta_data->>'full_name',''),'Customer'),'customer');
 insert into public.customers(tenant_id,branch_id,user_id,name,email,phone,marketing_consent,policy_version) values(p_tenant,p_branch,auth.uid(),coalesce(nullif(u.raw_user_meta_data->>'full_name',''),'Customer'),u.email,coalesce(u.raw_user_meta_data->>'phone',''),coalesce((u.raw_user_meta_data->>'marketing_consent')::boolean,false),'1.0') returning id into cid;
 insert into public.audit_events(tenant_id,branch_id,actor_id,action,entity_id,reason) values(p_tenant,p_branch,auth.uid(),'customer.enrolled',cid,'Verified email; customer-only membership');
end $$;
revoke all on function public.enrol_customer(uuid,uuid) from public;
grant execute on function public.enrol_customer(uuid,uuid) to authenticated;
-- One explicit command boundary keeps UI code independent from DB write details.
-- Locking the branch settings row serialises booking capacity and loyalty operations.
create function public.phase1_action(p_tenant uuid,p_branch uuid,p_action text,p_id uuid,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r text; s public.settings%rowtype; a public.appointments%rowtype; v public.vehicles%rowtype; rc public.recovery_cases%rowtype; adj public.adjustments%rowtype; m public.memberships%rowtype; camp public.campaigns%rowtype; cid uuid; eid uuid:=coalesce(p_id,gen_random_uuid()); dt date; tm time; when_at timestamptz; next_status text; pts integer; current_points bigint; note text; before_row jsonb; after_row jsonb; entity_table text;
begin
 r:=public.workspace_role(p_tenant,p_branch);
 if r is null or r not in ('customer','manager','administrator') then raise exception 'Active role required; Service Advisor work is on hold';end if;
 select * into s from public.settings where tenant_id=p_tenant and branch_id=p_branch for update;
 if not found then raise exception 'Branch configuration missing';end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid payload';end if;
 note:=coalesce(nullif(trim(p_payload->>'reason'),''),p_action);
 if p_action in ('appointment.create','appointment.reschedule') then
  if r not in ('customer','manager') then raise exception 'Appointment permission required';end if;
  if p_action='appointment.reschedule' then
   select * into a from public.appointments where id=p_id and tenant_id=p_tenant and branch_id=p_branch for update;
   if not found then raise exception 'Appointment unavailable';end if;
   before_row:=to_jsonb(a);cid:=a.customer_id;
   if a.status not in ('Booked','Confirmed') or ((a.date+a.time) at time zone 'Asia/Kuala_Lumpur')<now()+make_interval(hours=>s.cancel_hours) then raise exception 'Outside rescheduling window';end if;
  else cid:=(p_payload->>'customer_id')::uuid;end if;
  if not public.customer_visible(p_tenant,p_branch,cid) then raise exception 'Customer outside your scope';end if;
  select * into v from public.vehicles where id=coalesce(a.vehicle_id,(p_payload->>'vehicle_id')::uuid) and tenant_id=p_tenant and branch_id=p_branch and customer_id=cid and verified;
  if not found then raise exception 'A verified vehicle is required';end if;
  dt:=(p_payload->>'date')::date;tm:=(p_payload->>'time')::time;
  when_at:=(dt+tm) at time zone 'Asia/Kuala_Lumpur';
  if when_at is null or when_at<now()+make_interval(hours=>s.lead_hours) or dt=any(s.closed_dates) then raise exception 'Date unavailable or lead time too short';end if;
  if tm<'09:00'::time or tm>'16:30'::time or mod(extract(epoch from (tm-'09:00'::time))::integer,s.slot_minutes*60)<>0 then raise exception 'Choose an allowed branch time slot';end if;
  if (select count(*) from public.appointments where tenant_id=p_tenant and branch_id=p_branch and date=dt and time=tm and id<>eid and status not in ('Cancelled','No-show'))>=s.capacity then raise exception 'This slot is full';end if;
  if p_action='appointment.create' then
   if p_payload->>'service' not in ('Periodic maintenance','Vehicle health check','Customer consultation') then raise exception 'Unknown visit type';end if;
   insert into public.appointments(id,tenant_id,branch_id,customer_id,vehicle_id,advisor_id,service,date,time,notes) select eid,p_tenant,p_branch,cid,v.id,c.advisor_id,p_payload->>'service',dt,tm,coalesce(p_payload->>'notes','') from public.customers c where c.id=cid;
  else update public.appointments set date=dt,time=tm,updated_at=now() where id=eid;end if;
  entity_table:='appointments';
 elsif p_action='appointment.status' then
  if r not in ('customer','manager') then raise exception 'Operational permission required';end if;
  select * into a from public.appointments where id=p_id and tenant_id=p_tenant and branch_id=p_branch for update;
  if not found or not public.customer_visible(p_tenant,p_branch,a.customer_id) then raise exception 'Appointment unavailable';end if;
  before_row:=to_jsonb(a);next_status:=p_payload->>'status';
  if r='customer' and (next_status<>'Cancelled' or ((a.date+a.time) at time zone 'Asia/Kuala_Lumpur')<now()+make_interval(hours=>s.cancel_hours)) then raise exception 'Cancellation window closed';end if;
  if not ((a.status='Booked' and next_status in ('Confirmed','Cancelled')) or (a.status='Confirmed' and next_status in ('Arrived','Cancelled','No-show')) or (a.status='Arrived' and next_status='In Service') or (a.status='In Service' and next_status='Ready') or (a.status='Ready' and next_status='Completed')) then raise exception 'Invalid status transition';end if;
  update public.appointments set status=next_status,updated_at=now() where id=eid;
  if next_status='Completed' then update public.customers set last_visit=greatest(last_visit,current_date) where id=a.customer_id;end if;
  insert into public.notifications(tenant_id,branch_id,customer_id,category,title,body) values(p_tenant,p_branch,a.customer_id,'Transactional','Appointment updated','Your appointment is now '||next_status||'.');entity_table:='appointments';
 elsif p_action='capacity.update' then
  if r<>'manager' then raise exception 'Manager permission required';end if;
  eid:=s.id;before_row:=to_jsonb(s);
  update public.settings set capacity=(p_payload->>'capacity')::integer,closed_dates=array(select value::date from jsonb_array_elements_text(coalesce(p_payload->'closed_dates','[]'::jsonb))) where id=s.id;entity_table:='settings';
 elsif p_action='settings.update' then
  if r<>'administrator' then raise exception 'Administrator permission required';end if;
  eid:=s.id;before_row:=to_jsonb(s);
  update public.settings set slot_minutes=coalesce((p_payload->>'slot_minutes')::integer,slot_minutes),lead_hours=coalesce((p_payload->>'lead_hours')::integer,lead_hours),cancel_hours=coalesce((p_payload->>'cancel_hours')::integer,cancel_hours),at_risk_days=coalesce((p_payload->>'at_risk_days')::integer,at_risk_days),lapse_days=coalesce((p_payload->>'lapse_days')::integer,lapse_days),recovery_hours=coalesce((p_payload->>'recovery_hours')::integer,recovery_hours),low_rating=coalesce((p_payload->>'low_rating')::integer,low_rating),adjustment_threshold=coalesce((p_payload->>'adjustment_threshold')::integer,adjustment_threshold),reward_points=coalesce((p_payload->>'reward_points')::integer,reward_points),reward_value_sen=coalesce((p_payload->>'reward_value_sen')::bigint,reward_value_sen),tier_points=coalesce((p_payload->>'tier_points')::integer,tier_points),points_per_rm=coalesce((p_payload->>'points_per_rm')::integer,points_per_rm),points_expiry_days=coalesce((p_payload->>'points_expiry_days')::integer,points_expiry_days),promotion_limit_sen=coalesce((p_payload->>'promotion_limit_sen')::bigint,promotion_limit_sen),dealer_name=coalesce(nullif(trim(p_payload->>'dealer_name'),''),dealer_name) where id=s.id;entity_table:='settings';
 elsif p_action='feedback.create' then
  if r<>'customer' then raise exception 'Customer permission required';end if;
  cid:=(p_payload->>'customer_id')::uuid;
  if not public.customer_visible(p_tenant,p_branch,cid) then raise exception 'Customer outside your scope';end if;
  select * into a from public.appointments where id=(p_payload->>'appointment_id')::uuid and tenant_id=p_tenant and branch_id=p_branch and customer_id=cid and status='Completed';
  if not found then raise exception 'Completed appointment required';end if;
  insert into public.feedback(id,tenant_id,branch_id,customer_id,appointment_id,rating,comments,contact_requested) values(eid,p_tenant,p_branch,cid,a.id,(p_payload->>'rating')::integer,coalesce(p_payload->>'comments',''),coalesce((p_payload->>'contact_requested')::boolean,false));
  if (p_payload->>'rating')::integer<=s.low_rating then insert into public.recovery_cases(tenant_id,branch_id,customer_id,advisor_id,appointment_id,rating,comments,due_at) values(p_tenant,p_branch,cid,a.advisor_id,a.id,(p_payload->>'rating')::integer,coalesce(p_payload->>'comments',''),now()+make_interval(hours=>s.recovery_hours));end if;entity_table:='feedback';
 elsif p_action='recovery.update' then
  if r<>'manager' then raise exception 'Manager permission required';end if;
  select * into rc from public.recovery_cases where id=p_id and tenant_id=p_tenant and branch_id=p_branch for update;
  if not found then raise exception 'Case unavailable';end if;before_row:=to_jsonb(rc);
  if nullif(p_payload->>'advisor_id','') is not null and not exists(select 1 from public.memberships where tenant_id=p_tenant and branch_id=p_branch and user_id=(p_payload->>'advisor_id')::uuid and role in ('advisor','manager') and active) then raise exception 'Invalid case owner';end if;
  update public.recovery_cases set advisor_id=coalesce(nullif(p_payload->>'advisor_id','')::uuid,advisor_id),contact_log=contact_log||case when length(trim(coalesce(p_payload->>'contact_log','')))>0 then now()::text||' · '||auth.uid()::text||': '||(p_payload->>'contact_log')||E'\n' else '' end,outcome=coalesce(p_payload->>'outcome',outcome),status=coalesce(p_payload->>'status',status) where id=eid;entity_table:='recovery_cases';
 elsif p_action='campaign.create' then
  if r<>'manager' then raise exception 'Manager permission required';end if;
  if (p_payload->>'budget_sen')::bigint>s.promotion_limit_sen then raise exception 'Campaign exceeds configured budget ceiling';end if;
  insert into public.campaigns(id,tenant_id,branch_id,title,segment,budget_sen,starts_on,ends_on,description) values(eid,p_tenant,p_branch,nullif(trim(p_payload->>'title'),''),p_payload->>'segment',(p_payload->>'budget_sen')::bigint,(p_payload->>'starts_on')::date,(p_payload->>'ends_on')::date,nullif(trim(p_payload->>'description'),''));entity_table:='campaigns';
 elsif p_action='campaign.approve' then
  if r<>'manager' then raise exception 'Manager permission required';end if;
  select * into camp from public.campaigns where id=p_id and tenant_id=p_tenant and branch_id=p_branch for update;
  if not found or camp.budget_sen>s.promotion_limit_sen then raise exception 'Campaign unavailable or over budget';end if;before_row:=to_jsonb(camp);
  update public.campaigns set status='Approved' where id=eid;note:='Campaign approved; no outbound delivery invoked';entity_table:='campaigns';
 elsif p_action='adjustment.request' then
  if r not in ('manager','administrator') then raise exception 'Staff permission required';end if;
  cid:=(p_payload->>'customer_id')::uuid;if not public.customer_visible(p_tenant,p_branch,cid) then raise exception 'Customer outside scope';end if;
  insert into public.adjustments(id,tenant_id,branch_id,customer_id,points,reason,requested_by) values(eid,p_tenant,p_branch,cid,(p_payload->>'points')::integer,nullif(trim(p_payload->>'reason'),''),auth.uid());entity_table:='adjustments';
 elsif p_action in ('adjustment.approve','adjustment.post') then
  select * into adj from public.adjustments where id=p_id and tenant_id=p_tenant and branch_id=p_branch for update;
  if not found then raise exception 'Adjustment unavailable';end if;before_row:=to_jsonb(adj);
  if p_action='adjustment.approve' then
   if r<>'manager' or adj.status<>'Pending' or adj.requested_by=auth.uid() then raise exception 'Independent manager approval required';end if;
   update public.adjustments set status='Approved',approved_by=auth.uid() where id=eid;
  else
   if r<>'administrator' or adj.status='Posted' then raise exception 'Posting unavailable';end if;
   if abs(adj.points)>s.adjustment_threshold and (adj.approved_by is null or adj.approved_by=adj.requested_by) then raise exception 'Independent manager approval required above threshold';end if;
   select coalesce(sum(points),0) into current_points from public.loyalty_entries where tenant_id=p_tenant and customer_id=adj.customer_id;
   if current_points+adj.points<0 then raise exception 'Negative balance is not permitted';end if;
   insert into public.loyalty_entries(tenant_id,branch_id,customer_id,points,reason,reference) values(p_tenant,p_branch,adj.customer_id,adj.points,adj.reason,adj.id::text);
   update public.adjustments set status='Posted' where id=eid;
  end if;entity_table:='adjustments';
 elsif p_action='member.update' then
  if r<>'administrator' then raise exception 'Administrator permission required';end if;
  select * into m from public.memberships where id=p_id and tenant_id=p_tenant and branch_id=p_branch for update;
  if not found or m.user_id=auth.uid() then raise exception 'Cannot change your own access or an unavailable member';end if;
  if p_payload->>'role' not in ('customer','manager','administrator') then raise exception 'Role unavailable in this release';end if;
  if length(trim(coalesce(p_payload->>'reason','')))=0 then raise exception 'Access change reason required';end if;
  before_row:=to_jsonb(m);update public.memberships set role=p_payload->>'role',active=(p_payload->>'active')::boolean where id=eid;entity_table:='memberships';
 elsif p_action='customer.update' then
  if r not in ('customer','administrator') then raise exception 'Customer or administrator permission required';end if;
  cid:=(p_payload->>'customer_id')::uuid;if not public.customer_visible(p_tenant,p_branch,cid) then raise exception 'Customer outside scope';end if;
  eid:=cid;select to_jsonb(c) into before_row from public.customers c where id=cid;
  update public.customers set phone=coalesce(nullif(p_payload->>'phone',''),phone),marketing_consent=coalesce((p_payload->>'marketing_consent')::boolean,marketing_consent),consent_at=case when p_payload ? 'marketing_consent' then now() else consent_at end where id=cid;entity_table:='customers';
 elsif p_action='vehicle.create' then
  if r<>'customer' then raise exception 'Customer permission required';end if;
  cid:=(p_payload->>'customer_id')::uuid;if not public.customer_visible(p_tenant,p_branch,cid) then raise exception 'Customer outside scope';end if;
  insert into public.vehicles(id,tenant_id,branch_id,customer_id,registration,model,year,mileage) values(eid,p_tenant,p_branch,cid,upper(nullif(trim(p_payload->>'registration'),'')),nullif(trim(p_payload->>'model'),''),(p_payload->>'year')::integer,(p_payload->>'mileage')::integer);entity_table:='vehicles';
 elsif p_action='vehicle.verify' then
  if r<>'administrator' or length(trim(coalesce(p_payload->>'reason','')))=0 then raise exception 'Administrator and evidence reference required';end if;
  select * into v from public.vehicles where id=p_id and tenant_id=p_tenant and branch_id=p_branch for update;
  if not found then raise exception 'Vehicle unavailable';end if;before_row:=to_jsonb(v);
  if exists(select 1 from public.vehicles x where x.tenant_id=p_tenant and x.id<>v.id and x.verified and x.registration=v.registration) then raise exception 'Registration already linked. Resolve ownership history before verifying.';end if;
  update public.vehicles set verified=true where id=eid;entity_table:='vehicles';
 else raise exception 'Operation unavailable in this Phase 1 release';end if;
 if entity_table is not null then execute format('select to_jsonb(t) from public.%I t where id=$1',entity_table) into after_row using eid;end if;
 insert into public.audit_events(tenant_id,branch_id,actor_id,action,entity_id,reason,before_data,after_data) values(p_tenant,p_branch,auth.uid(),p_action,eid,note,before_row,after_row);
end $$;
revoke all on function public.phase1_action(uuid,uuid,text,uuid,jsonb) from public;
grant execute on function public.phase1_action(uuid,uuid,text,uuid,jsonb) to authenticated;
commit;
