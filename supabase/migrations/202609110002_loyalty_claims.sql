begin;
create table public.loyalty_claims(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,customer_id uuid not null,
 document_id uuid not null unique references public.service_documents(id),
 status text not null default 'Extracting' check(status in ('Extracting','Review details','Extraction failed','Pending verification','Credited','Rejected')),
 merchant text not null default '',invoice_number text not null default '',invoice_date text not null default '',
 total_sen bigint not null default 0 check(total_sen between 0 and 100000000),eligible_sen bigint not null default 0 check(eligible_sen between 0 and total_sen),
 points integer not null default 0,rate integer not null default 0,paid_reference text not null default '',review_note text not null default '',
 extracted jsonb not null default '{}',created_at timestamptz not null default now(),confirmed_at timestamptz,reviewed_at timestamptz,reviewed_by uuid references auth.users(id),
 foreign key(tenant_id,branch_id,customer_id) references public.customers(tenant_id,branch_id,id));
create unique index credited_invoice_once on public.loyalty_claims(tenant_id,branch_id,invoice_number) where status='Credited';
create unique index credited_payment_once on public.loyalty_claims(tenant_id,branch_id,paid_reference) where status='Credited';
alter table public.loyalty_claims enable row level security;
revoke all on public.loyalty_claims from anon,authenticated;
grant select on public.loyalty_claims to authenticated;
create policy claims_read on public.loyalty_claims for select to authenticated using(public.customer_visible(tenant_id,branch_id,customer_id));
-- OCR jobs are server-only. Clients cannot inject extraction results or provider URLs.
create table public.loyalty_ocr_jobs(document_id uuid primary key references public.service_documents(id),operation_url text,started_at timestamptz not null default now());
alter table public.loyalty_ocr_jobs enable row level security;
revoke all on public.loyalty_ocr_jobs from anon,authenticated;
grant all on public.loyalty_claims,public.loyalty_ocr_jobs to service_role;
grant select on public.service_documents to service_role;
create function public.loyalty_action(p_tenant uuid,p_branch uuid,p_action text,p_id uuid,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r text; c public.loyalty_claims%rowtype; before_row jsonb; amount bigint; rate_value integer; invoice text; paid text; note text; dt date;
begin
 r:=public.workspace_role(p_tenant,p_branch);
 if r is null or r not in ('customer','manager','administrator') then raise exception 'Active role required; Service Advisor is on hold';end if;
 -- Serialise approvals against rate changes and branch-level duplicate transaction checks.
 select points_per_rm into rate_value from public.settings where tenant_id=p_tenant and branch_id=p_branch for update;
 select * into c from public.loyalty_claims where id=p_id and tenant_id=p_tenant and branch_id=p_branch for update;
 if not found or not public.customer_visible(p_tenant,p_branch,c.customer_id) then raise exception 'Claim outside your scope';end if;
 before_row:=to_jsonb(c);
 if p_action='loyalty.confirm' then
  if r<>'customer' or c.status not in ('Review details','Extraction failed') then raise exception 'Customer review required';end if;
  invoice:=regexp_replace(upper(trim(p_payload->>'invoice_number')),'[^A-Z0-9]','','g');dt:=(p_payload->>'invoice_date')::date;
  if coalesce(invoice,'')='' or length(trim(coalesce(p_payload->>'merchant','')))=0 or dt is null or dt>current_date or coalesce((p_payload->>'currency_confirmed')::boolean,false)=false then raise exception 'Invoice details and MYR confirmation required';end if;
  amount:=(p_payload->>'total_sen')::bigint;if amount is null or amount<1 or amount>100000000 then raise exception 'Invalid invoice amount';end if;
  update public.loyalty_claims set merchant=trim(p_payload->>'merchant'),invoice_number=invoice,invoice_date=dt::text,total_sen=amount,status='Pending verification',confirmed_at=now() where id=c.id;
 elsif p_action in ('loyalty.approve','loyalty.reject') then
  if r<>'manager' then raise exception 'Manager payment verification required';end if;
  if exists(select 1 from public.customers where id=c.customer_id and user_id=auth.uid()) then raise exception 'A different manager must verify this claim';end if;
  if c.status='Credited' and p_action='loyalty.approve' then return;end if;
  if c.status<>'Pending verification' then raise exception 'Claim is not pending verification';end if;
  note:=trim(p_payload->>'review_note');if coalesce(note,'')='' then raise exception 'Review reason required';end if;
  if p_action='loyalty.reject' then
   update public.loyalty_claims set status='Rejected',review_note=note,reviewed_by=auth.uid(),reviewed_at=now() where id=c.id;
  else
   amount:=(p_payload->>'eligible_sen')::bigint;paid:=regexp_replace(upper(trim(p_payload->>'paid_reference')),'[^A-Z0-9]','','g');
   if coalesce((p_payload->>'paid_confirmed')::boolean,false)=false or coalesce(paid,'')='' then raise exception 'Confirm paid dealer transaction and reference';end if;
   if amount is null or amount<1 or amount>c.total_sen or rate_value is null or floor(amount::numeric*rate_value/100)<1 or floor(amount::numeric*rate_value/100)>2147483647 then raise exception 'Invalid eligible spending';end if;
   if exists(select 1 from public.loyalty_claims where tenant_id=p_tenant and branch_id=p_branch and status='Credited' and (invoice_number=c.invoice_number or paid_reference=paid)) then raise exception 'Duplicate invoice or payment already credited';end if;
   update public.loyalty_claims set status='Credited',eligible_sen=amount,rate=rate_value,points=floor(amount::numeric*rate_value/100)::integer,paid_reference=paid,review_note=note,reviewed_by=auth.uid(),reviewed_at=now() where id=c.id;
   insert into public.loyalty_entries(tenant_id,branch_id,customer_id,points,reason,reference) values(p_tenant,p_branch,c.customer_id,floor(amount::numeric*rate_value/100)::integer,'Verified spending · '||c.invoice_number,'claim:'||c.id::text);
   insert into public.notifications(tenant_id,branch_id,customer_id,category,title,body) values(p_tenant,p_branch,c.customer_id,'Transactional','Loyalty points credited',floor(amount::numeric*rate_value/100)::text||' points credited for invoice '||c.invoice_number);
  end if;
 else raise exception 'Unknown loyalty action';end if;
 insert into public.audit_events(tenant_id,branch_id,actor_id,action,entity_id,reason,before_data,after_data) select p_tenant,p_branch,auth.uid(),p_action,c.id,coalesce(note,'Customer confirmed invoice and currency'),before_row,to_jsonb(x) from public.loyalty_claims x where id=c.id;
end $$;
revoke all on function public.loyalty_action(uuid,uuid,text,uuid,jsonb) from public;
grant execute on function public.loyalty_action(uuid,uuid,text,uuid,jsonb) to authenticated;
commit;
