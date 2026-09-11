// Real PostgreSQL execution using PGlite; Auth schema is stubbed, not email/session delivery.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();let checks=0;
const u=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const t=u(1),b=u(2),t2=u(3),b2=u(4),admin=u(10),manager=u(11),customer=u(12),other=u(13),advisor=u(14),newUser=u(15),c=u(20),c2=u(21),v=u(30),v2=u(31),ap=u(40),adj=u(50);
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/202609090001_phase1.sql',import.meta.url),'utf8'));checks++;
await db.exec(fs.readFileSync(new URL('../supabase/migrations/202609100001_phase2.sql',import.meta.url),'utf8'));checks++;
// Storage API metadata is stubbed; policies execute in real PostgreSQL.
await db.exec(`create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb); alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
await db.exec(fs.readFileSync(new URL('../supabase/migrations/202609110001_service_documents.sql',import.meta.url),'utf8'));checks++;
for(const [id,name] of [[admin,'Admin'],[manager,'Manager'],[customer,'Customer'],[other,'Other'],[advisor,'Advisor'],[newUser,'New customer']])await db.query('insert into auth.users values($1,$2,now(),$3)',[id,name.toLowerCase()+'@example.test',JSON.stringify({full_name:name,role:'administrator'})]);
await db.exec(`insert into public.tenants values('${t}','Dealer one',true),('${t2}','Dealer two',true);insert into public.branches values('${b}','${t}','Branch one'),('${b2}','${t2}','Branch two');insert into public.settings(tenant_id,branch_id,dealer_name) values('${t}','${b}','Dealer one'),('${t2}','${b2}','Dealer two');`);
for(const [uid,role] of [[admin,'administrator'],[manager,'manager'],[customer,'customer'],[advisor,'advisor']])await db.query('insert into public.memberships(tenant_id,branch_id,user_id,name,role) values($1,$2,$3,$4,$5)',[t,b,uid,role,role]);
await db.exec(`insert into public.memberships(tenant_id,branch_id,user_id,name,role) values('${t2}','${b2}','${other}','Other','customer');insert into public.customers(id,tenant_id,branch_id,user_id,name,email,last_visit) values('${c}','${t}','${b}','${customer}','Customer','c@example.test',current_date-230),('${c2}','${t2}','${b2}','${other}','Other','o@example.test',current_date-20);insert into public.vehicles(id,tenant_id,branch_id,customer_id,registration,model,year,mileage,verified) values('${v}','${t}','${b}','${c}','ABC 1234','Civic',2020,50000,true),('${v2}','${t2}','${b2}','${c2}','XYZ 9876','City',2021,40000,true);insert into public.appointments(id,tenant_id,branch_id,customer_id,vehicle_id,service,date,time,status) values('${ap}','${t}','${b}','${c}','${v}','Periodic maintenance',current_date-1,'09:00','Completed');insert into public.loyalty_entries(tenant_id,branch_id,customer_id,points,reason,reference) values('${t}','${b}','${c}',1000,'Opening test balance','opening');insert into public.adjustments(id,tenant_id,branch_id,customer_id,points,reason,requested_by) values('${adj}','${t}','${b}','${c}',600,'Goodwill','${admin}');`);
async function asUser(uid){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await db.exec('set role authenticated')}
async function action(type,id,payload,tenant=t,branch=b){return db.query('select public.phase1_action($1,$2,$3,$4,$5)',[tenant,branch,type,id,JSON.stringify(payload)])}
async function rejects(fn,pattern){await assert.rejects(fn,pattern);checks++}
async function count(table,n){const r=await db.query(`select count(*)::integer n from public.${table}`);assert.equal(r.rows[0].n,n);checks++}
await asUser(customer);await count('customers',1);await count('vehicles',1);await count('audit_events',0);await count('recovery_cases',0);
await rejects(()=>db.exec(`update public.memberships set role='administrator'`),/permission denied/i);
await rejects(()=>action('settings.update',null,{capacity:50}),/Administrator permission/);
await rejects(()=>action('appointment.create',null,{customer_id:c2,vehicle_id:v2,service:'Periodic maintenance',date:'2030-01-10',time:'09:00'}),/scope/);
await rejects(()=>action('capacity.update',null,{capacity:5},t2,b2),/Active role/);
await action('appointment.create',null,{customer_id:c,vehicle_id:v,service:'Periodic maintenance',date:'2030-01-10',time:'09:00'});checks++;
await rejects(()=>action('appointment.create',null,{customer_id:c,vehicle_id:v,service:'Periodic maintenance',date:'2030-01-10',time:'09:15'}),/allowed branch time/);
await action('feedback.create',null,{customer_id:c,appointment_id:ap,rating:2,comments:'A delay',contact_requested:true});checks++;
await rejects(()=>action('feedback.create',null,{customer_id:c,appointment_id:ap,rating:2}),/duplicate key/);
await asUser(manager);await count('recovery_cases',1);
const recovery=(await db.query('select id from public.recovery_cases')).rows[0].id;
await rejects(()=>action('recovery.update',recovery,{status:'Resolved',outcome:'Fixed'}),/check constraint/);
await action('recovery.update',recovery,{status:'Resolved',outcome:'Customer confirmed remedy',contact_log:'Called customer'});checks++;
await rejects(()=>action('appointment.status',ap,{status:'Confirmed'}),/Invalid status/);
await action('capacity.update',null,{capacity:1,closed_dates:[]});checks++;
await asUser(customer);await rejects(()=>action('appointment.create',null,{customer_id:c,vehicle_id:v,service:'Periodic maintenance',date:'2030-01-10',time:'09:00'}),/slot is full/);
await asUser(admin);await rejects(()=>action('adjustment.post',adj,{}),/Independent manager approval/);
await asUser(manager);await action('adjustment.approve',adj,{});checks++;
await asUser(admin);await action('adjustment.post',adj,{});checks++;
assert.equal((await db.query(`select sum(points)::integer n from public.loyalty_entries where customer_id='${c}'`)).rows[0].n,1600);checks++;
await rejects(()=>action('adjustment.post',adj,{}),/Posting unavailable/);
await rejects(()=>db.exec('delete from public.audit_events'),/permission denied/);
const own=(await db.query(`select id from public.memberships where user_id='${admin}'`)).rows[0].id;
await rejects(()=>action('member.update',own,{role:'manager',active:false,reason:'Test'}),/own access/);
await asUser(advisor);await rejects(()=>action('appointment.create',null,{}),/on hold/);await count('customers',0);
async function phase2(type,id,payload,tenant=t,branch=b){return db.query('select public.phase2_action($1,$2,$3,$4,$5)',[tenant,branch,type,id,JSON.stringify(payload)])}
await asUser(advisor);await rejects(()=>phase2('phase2.request.create',null,{}),/on hold/);await count('service_requests',0);
await asUser(customer);await rejects(()=>phase2('phase2.catalogue.create',null,{}),/Administrator/);
await rejects(()=>phase2('phase2.request.create',null,{vehicle_id:v2,category:'Parts',details:'Invalid ownership'}),/owned vehicle/);
await phase2('phase2.request.create',null,{vehicle_id:v,category:'Parts',details:'Battery fitment enquiry'});await count('service_requests',1);
const request=(await db.query('select id from public.service_requests')).rows[0].id;
await rejects(()=>phase2('phase2.request.update',request,{status:'Closed',outcome:'Attempt'}),/Manager/);
await asUser(other);await count('service_requests',0);
await asUser(manager);await phase2('phase2.request.update',request,{status:'In progress',outcome:'Checking compatibility'});checks++;
await rejects(()=>phase2('phase2.request.update',request,{status:'Closed',outcome:''}),/outcome/);
await phase2('phase2.request.update',request,{status:'Closed',outcome:'Customer confirmed resolution'});checks++;
await rejects(()=>phase2('phase2.request.update',request,{status:'In progress',outcome:'Reopen'}),/transition/);
await asUser(admin);await phase2('phase2.catalogue.create',null,{title:'Maintenance',category:'Maintenance',description:'Dealer list',price_sen:20000,effective_on:'2026-01-01'});checks++;
const item=(await db.query('select id from public.service_catalogue')).rows[0].id;
await rejects(()=>db.exec('delete from public.service_catalogue'),/permission denied/);
await phase2('phase2.catalogue.archive',item,{});checks++;
await asUser(customer);await count('service_catalogue',0);
async function docAction(type,id,payload){return db.query('select public.document_action($1,$2,$3,$4,$5)',[t,b,type,id,JSON.stringify(payload)])}
await asUser(customer);
const evidencePath=`${t}/${b}/${c}/${request}/${u(99)}`;
await db.query("insert into storage.objects(bucket_id,name,metadata) values('service-evidence',$1,$2)",[evidencePath,JSON.stringify({mimetype:'application/pdf',size:100})]);checks++;
await rejects(()=>db.query("insert into storage.objects(bucket_id,name,metadata) values('service-evidence',$1,'{}')",[`${t2}/${b2}/${c2}/${request}/${u(98)}`]),/row-level security/);
await docAction('document.register',null,{request_id:request,storage_path:evidencePath,filename:'receipt.pdf',mime_type:'application/pdf',kind:'Receipt',amount_sen:5000,payment_reference:'TEST-1'});checks++;
const evidence=(await db.query('select id from public.service_documents')).rows[0].id;
await rejects(()=>docAction('document.review',evidence,{status:'Verified',review_note:'Self review'}),/Manager/);
await count('service_documents',1);
await asUser(other);await count('service_documents',0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);checks++;
await asUser(advisor);await count('service_documents',0);await rejects(()=>docAction('document.review',evidence,{}),/on hold/);
await asUser(manager);await rejects(()=>docAction('document.review',evidence,{status:'Verified',review_note:''}),/note required/);
await docAction('document.review',evidence,{status:'Verified',review_note:'Matched receipt TEST-1 to dealer record'});checks++;
await rejects(()=>docAction('document.review',evidence,{status:'Rejected',review_note:'Overwrite'}),/no longer/);
assert.equal((await db.query(`select sum(points)::integer n from public.loyalty_entries where customer_id='${c}'`)).rows[0].n,1600);checks++;
await asUser(customer);await db.query('delete from storage.objects where name=$1',[evidencePath]);assert.equal((await db.query('select * from storage.objects where name=$1',[evidencePath])).rows.length,1);checks++;
await asUser(newUser);await db.query('select public.enrol_customer($1,$2)',[t,b]);assert.equal((await db.query('select role from public.memberships where user_id=$1',[newUser])).rows[0].role,'customer');checks++;
await rejects(()=>db.query('select public.enrol_customer($1,$2)',[t,b]),/already exists/);
await asUser(admin);const mid=(await db.query('select id from public.memberships where user_id=$1',[manager])).rows[0].id;await action('member.update',mid,{role:'manager',active:false,reason:'Access suspension test'});
await asUser(manager);await count('customers',0);await rejects(()=>action('capacity.update',null,{capacity:10}),/Active role/);
await db.close();console.log(`PASS: ${checks} PostgreSQL migration, RLS, registration, workflow and ledger checks.`);
