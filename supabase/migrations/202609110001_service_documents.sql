-- Private evidence storage. Reviewed evidence is not a payment ledger event.
begin;
create table public.service_documents(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,branch_id uuid not null,
 request_id uuid not null references public.service_requests(id),customer_id uuid not null,
 filename text not null check(length(trim(filename)) between 1 and 255),mime_type text not null check(mime_type in ('image/jpeg','image/png','application/pdf')),
 storage_path text not null unique,kind text not null check(kind in ('Receipt','Invoice','Supporting document')),
 amount_sen bigint not null default 0 check(amount_sen between 0 and 100000000),payment_reference text not null default '',
 status text not null default 'Awaiting verification' check(status in ('Awaiting verification','Verified','Rejected')),
 review_note text not null default '',reviewed_by uuid references auth.users(id),created_at timestamptz not null default now(),
 foreign key(tenant_id,branch_id,customer_id) references public.customers(tenant_id,branch_id,id));
alter table public.service_documents enable row level security;
revoke all on public.service_documents from anon,authenticated;
grant select on public.service_documents to authenticated;
create policy evidence_read on public.service_documents for select to authenticated using(public.customer_visible(tenant_id,branch_id,customer_id));
create index evidence_request on public.service_documents(tenant_id,branch_id,request_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('service-evidence','service-evidence',false,5242880,array['image/jpeg','image/png','application/pdf']);
-- UUID text comparison avoids cast exceptions on untrusted paths.
create function public.owns_evidence_path(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.service_requests r join public.customers c on c.id=r.customer_id and c.tenant_id=r.tenant_id and c.branch_id=r.branch_id
 where c.user_id=auth.uid() and public.workspace_role(r.tenant_id,r.branch_id)='customer'
 and split_part(path,'/',1)=r.tenant_id::text and split_part(path,'/',2)=r.branch_id::text
 and split_part(path,'/',3)=r.customer_id::text and split_part(path,'/',4)=r.id::text
 and array_length(string_to_array(path,'/'),1)=5 and length(split_part(path,'/',5))=36)
$$;
revoke all on function public.owns_evidence_path(text) from public;
grant execute on function public.owns_evidence_path(text) to authenticated;
create policy evidence_upload on storage.objects for insert to authenticated with check(bucket_id='service-evidence' and public.owns_evidence_path(name));
create policy evidence_download on storage.objects for select to authenticated using(bucket_id='service-evidence' and (public.owns_evidence_path(name) or exists(select 1 from public.service_documents d where d.storage_path=name and public.customer_visible(d.tenant_id,d.branch_id,d.customer_id))));
-- Failed registrations may remove only their unregistered upload; registered evidence is immutable.
create policy evidence_cleanup on storage.objects for delete to authenticated using(bucket_id='service-evidence' and public.owns_evidence_path(name) and not exists(select 1 from public.service_documents d where d.storage_path=name));
create function public.document_action(p_tenant uuid,p_branch uuid,p_action text,p_id uuid,p_payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare role_name text; r public.service_requests%rowtype; d public.service_documents%rowtype; eid uuid:=gen_random_uuid(); path text; previous jsonb;
begin
 role_name:=public.workspace_role(p_tenant,p_branch);
 if role_name is null or role_name not in ('customer','manager','administrator') then raise exception 'Active role required; Service Advisor remains on hold';end if;
 if p_action='document.register' then
  if role_name<>'customer' then raise exception 'Customer upload required';end if;
  select * into r from public.service_requests where id=(p_payload->>'request_id')::uuid and tenant_id=p_tenant and branch_id=p_branch;
  if not found or not public.customer_visible(p_tenant,p_branch,r.customer_id) then raise exception 'Request outside your scope';end if;
  path:=p_payload->>'storage_path';
  if not public.owns_evidence_path(path) or split_part(path,'/',4)<>r.id::text then raise exception 'Invalid evidence path';end if;
  if not exists(select 1 from storage.objects where bucket_id='service-evidence' and name=path and metadata->>'mimetype'=p_payload->>'mime_type' and (metadata->>'size')::bigint between 1 and 5242880) then raise exception 'Upload missing or metadata mismatch';end if;
  insert into public.service_documents(id,tenant_id,branch_id,request_id,customer_id,filename,mime_type,storage_path,kind,amount_sen,payment_reference)
  values(eid,p_tenant,p_branch,r.id,r.customer_id,p_payload->>'filename',p_payload->>'mime_type',path,p_payload->>'kind',coalesce((p_payload->>'amount_sen')::bigint,0),coalesce(p_payload->>'payment_reference',''));
 elsif p_action='document.review' then
  if role_name<>'manager' then raise exception 'Manager verification required';end if;
  select * into d from public.service_documents where id=p_id and tenant_id=p_tenant and branch_id=p_branch for update;
  if not found or d.status<>'Awaiting verification' then raise exception 'Document no longer awaiting verification';end if;
  if p_payload->>'status' is null or p_payload->>'status' not in ('Verified','Rejected') or length(trim(coalesce(p_payload->>'review_note','')))=0 then raise exception 'Review decision and note required';end if;
  previous:=to_jsonb(d);eid:=d.id;
  update public.service_documents set status=p_payload->>'status',review_note=p_payload->>'review_note',reviewed_by=auth.uid() where id=d.id;
 else raise exception 'Unknown document action';end if;
 insert into public.audit_events(tenant_id,branch_id,actor_id,action,entity_id,reason,before_data,after_data)
 select p_tenant,p_branch,auth.uid(),p_action,eid,case when p_action='document.review' then p_payload->>'review_note' else 'Document submitted for review' end,previous,to_jsonb(x) from public.service_documents x where id=eid;
end $$;
revoke all on function public.document_action(uuid,uuid,text,uuid,jsonb) from public;
grant execute on function public.document_action(uuid,uuid,text,uuid,jsonb) to authenticated;
commit;
