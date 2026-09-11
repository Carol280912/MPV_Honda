-- Additive Phase 2 service catalogue and customer request foundation.
begin;
create table public.service_catalogue (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,
 title text not null check(length(trim(title))>0),category text not null,description text not null check(length(trim(description))>0),
 price_sen bigint not null check(price_sen between 0 and 10000000),effective_on date not null,active boolean not null default true,
 foreign key(tenant_id,branch_id) references public.branches(tenant_id,id));
create table public.service_requests (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,customer_id uuid not null,vehicle_id uuid not null,
 category text not null check(category in ('Maintenance','Repairs','Parts','Insurance','Towing','Referral','Trade-in')),
 details text not null check(length(trim(details))>0),status text not null default 'Requested' check(status in ('Requested','In progress','Waiting for customer','Closed')),
 outcome text not null default '',created_at timestamptz not null default now(),
 foreign key(tenant_id,branch_id,customer_id) references public.customers(tenant_id,branch_id,id),
 foreign key(tenant_id,branch_id,vehicle_id) references public.vehicles(tenant_id,branch_id,id));
alter table public.service_catalogue enable row level security;
alter table public.service_requests enable row level security;
revoke all on public.service_catalogue,public.service_requests from anon,authenticated;
grant select on public.service_catalogue,public.service_requests to authenticated;
create policy catalogue_read on public.service_catalogue for select to authenticated using(public.workspace_role(tenant_id,branch_id) in ('manager','administrator') or (public.workspace_role(tenant_id,branch_id)='customer' and active));
create policy requests_read on public.service_requests for select to authenticated using(public.customer_visible(tenant_id,branch_id,customer_id));
create index request_queue on public.service_requests(tenant_id,branch_id,status,created_at);
create function public.phase2_action(p_tenant uuid,p_branch uuid,p_action text,p_id uuid,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r text; eid uuid:=gen_random_uuid(); cid uuid; vid uuid; previous public.service_requests%rowtype; nxt text; note text; before_row jsonb; after_row jsonb;
begin
 r:=public.workspace_role(p_tenant,p_branch);
 if r is null or r not in ('customer','manager','administrator') then raise exception 'Active role required; Service Advisor remains on hold'; end if;
 if p_action='phase2.catalogue.create' then
  if r<>'administrator' then raise exception 'Administrator required';end if;
  insert into public.service_catalogue(id,tenant_id,branch_id,title,category,description,price_sen,effective_on) values(eid,p_tenant,p_branch,p_payload->>'title',p_payload->>'category',p_payload->>'description',(p_payload->>'price_sen')::bigint,(p_payload->>'effective_on')::date);
  select to_jsonb(x) into after_row from public.service_catalogue x where id=eid;
  note:='Catalogue version created';
 elsif p_action='phase2.catalogue.archive' then
  if r<>'administrator' then raise exception 'Administrator required';end if;
  select to_jsonb(x) into before_row from public.service_catalogue x where id=p_id and tenant_id=p_tenant and branch_id=p_branch for update;
  if not found then raise exception 'Catalogue unavailable';end if;
  update public.service_catalogue set active=false where id=p_id;
  eid:=p_id;note:='Catalogue version archived';
 elsif p_action='phase2.request.create' then
  if r<>'customer' then raise exception 'Customer required';end if;
  select id into cid from public.customers where tenant_id=p_tenant and branch_id=p_branch and user_id=auth.uid();
  vid:=(p_payload->>'vehicle_id')::uuid;
  if cid is null or not exists(select 1 from public.vehicles where id=vid and customer_id=cid and tenant_id=p_tenant and branch_id=p_branch and verified) then raise exception 'Verified owned vehicle required';end if;
  insert into public.service_requests(id,tenant_id,branch_id,customer_id,vehicle_id,category,details) values(eid,p_tenant,p_branch,cid,vid,p_payload->>'category',p_payload->>'details');
  select to_jsonb(x) into after_row from public.service_requests x where id=eid;
  note:='Customer request received';
 elsif p_action='phase2.request.update' then
  if r<>'manager' then raise exception 'Manager required';end if;
  select * into previous from public.service_requests where id=p_id and tenant_id=p_tenant and branch_id=p_branch for update;
  if not found then raise exception 'Request unavailable';end if;
  nxt:=p_payload->>'status'; note:=trim(p_payload->>'outcome');
  if note is null or note='' then raise exception 'Customer-visible outcome required';end if;
  if nxt is null or not ((previous.status='Requested' and nxt in ('In progress','Closed')) or (previous.status='In progress' and nxt in ('Waiting for customer','Closed')) or (previous.status='Waiting for customer' and nxt in ('In progress','Closed'))) then raise exception 'Invalid transition';end if;
  before_row:=to_jsonb(previous);
  update public.service_requests set status=nxt,outcome=note where id=p_id;
  select to_jsonb(x) into after_row from public.service_requests x where id=p_id;
  insert into public.notifications(tenant_id,branch_id,customer_id,category,title,body) values(p_tenant,p_branch,previous.customer_id,'Transactional',previous.category||' request updated',note);
  eid:=p_id;
 else raise exception 'Unknown Phase 2 command';end if;
 insert into public.audit_events(tenant_id,branch_id,actor_id,action,entity_id,reason,before_data,after_data) values(p_tenant,p_branch,auth.uid(),p_action,eid,note,before_row,after_row);
end $$;
revoke all on function public.phase2_action(uuid,uuid,text,uuid,jsonb) from public;
grant execute on function public.phase2_action(uuid,uuid,text,uuid,jsonb) to authenticated;
commit;
