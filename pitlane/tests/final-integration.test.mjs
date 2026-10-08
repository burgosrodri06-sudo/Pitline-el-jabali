import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { safeNextPath, withNext } from '../lib/auth/redirects.ts';
import { bookingHref, packageValidOn } from '../lib/catalog.ts';
import { resolveBookingSelection, bookingLoginHref } from '../app/reservar/booking-form.ts';

test('KRE canonical UUID selection survives login, registration and verification without sessionStorage', () => {
  const [event,slot,pkg] = [randomUUID(),randomUUID(),randomUUID()];
  const href=bookingHref(event,slot,pkg);
  assert.equal(new URL(href,'https://pitlane.test').pathname,'/reservar');
  const query=Object.fromEntries(new URL(href,'https://pitlane.test').searchParams);
  const selected=resolveBookingSelection(query,{eventDates:[{id:event,date:'2026-11-01'}],slots:[{id:slot,eventDateId:event,remainingKarts:5}],packages:[{id:pkg,karts:5}]});
  assert.equal(selected.invalidSelection,false);
  let next=new URL(bookingLoginHref(selected.initial),'https://pitlane.test').searchParams.get('next');
  for(const route of ['/registro','/verificar-correo','/login']) {
    next=new URL(withNext(route,next),'https://pitlane.test').searchParams.get('next');
    assert.equal(next,href);
  }
});
test('auth rejects normalized external redirects and keeps local query IDs',()=>{
  for(const next of ['https://evil.test','//evil.test','/\\evil.test','/\n/evil.test','/\t/evil.test','javascript:alert(1)',' /reservar']) assert.equal(safeNextPath(next),null,next);
  assert.equal(safeNextPath('/reservar?evento=a&tanda=b'),'/reservar?evento=a&tanda=b');
  assert.equal(withNext('/login','//evil.test'),'/login');
});
test('package dates use selected event date, not today; boundaries inclusive',()=>{
  const p={active:true,validFrom:'2026-11-01',validTo:'2026-11-30'};
  assert.equal(packageValidOn(p,'2026-10-31'),false);
  assert.equal(packageValidOn(p,'2026-11-01'),true);
  assert.equal(packageValidOn(p,'2026-11-30'),true);
  assert.equal(packageValidOn(p,'2026-12-01'),false);
  assert.equal(packageValidOn({...p,active:false},'2026-11-15'),false);
});
async function moduleAt(path,imports,extras={}) {
  const source=await readFile(new URL(path,import.meta.url),'utf8'); const exports={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {exports,URL,Headers,process:{env:{}},...extras,require:name=>{assert.ok(name in imports,name);return imports[name];}});
  return exports;
}
test('actual proxy preserves filters and refreshed cookies when redirecting to login',async()=>{
  const makeResponse=location=>{const cookies=[];return {location,headers:new Headers(),cookies:{set:(...args)=>cookies.push(args.length===1?args[0]:{name:args[0],value:args[1]}),getAll:()=>cookies}};};
  const proxy=await moduleAt('../proxy.ts',{
    'next/server':{NextResponse:{next:()=>makeResponse(),redirect:url=>makeResponse(url.toString())}},
    '@supabase/ssr':{createServerClient:(_url,_key,options)=>({auth:{getUser:async()=>{options.cookies.setAll([{name:'expired-auth',value:'',options:{maxAge:0}}],{});return {data:{user:null}};}}})},
  });
  const nextUrl=new URL('https://pitlane.test/staff/check-in?date=2026-11-01&slot=abc'); nextUrl.clone=()=>new URL(nextUrl);
  const response=await proxy.proxy({headers:new Headers(),nextUrl,cookies:{getAll:()=>[],set:()=>{}}});
  assert.equal(new URL(response.location).searchParams.get('next'),'/staff/check-in?date=2026-11-01&slot=abc');
  assert.equal(response.cookies.getAll()[0].name,'expired-auth');
  assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('reservation card hides upload after expiry or rejection, without inventing paid state',async()=>{
  const card=await moduleAt('../components/operations/reservation-card.tsx',{
    'react/jsx-runtime':jsx,'next/link':{default:props=>React.createElement('a',props)},
    'qrcode':{default:{toDataURL:()=>{throw Error('No QR for pending payment');}}},
    '@/lib/operations/service':{operationTime:async()=>Date.parse('2026-11-01T18:00:00Z')},
    '@/lib/operations/rules':{canDisplayQr:()=>false},
    './ui':{dateTime:x=>x,time:x=>x,money:x=>String(x),StatusBadge:({status})=>React.createElement('span',null,status),styles:{}},
  });
  const r={id:randomUUID(),code:'KRE-TEST',status:'pending_payment',expiresAt:'2026-11-01T17:00:00Z',
    amount:15,spots:1,payments:[],participants:[],slot:{startsAt:'2026-11-01T19:00:00Z',endsAt:'2026-11-01T19:10:00Z'}};
  const expired=renderToStaticMarkup(await card.ReservationCard({reservation:r}));
  assert.match(expired,/plazo del apartado venció/); assert.doesNotMatch(expired,/Continuar al pago/);
  const rejected=renderToStaticMarkup(await card.ReservationCard({reservation:{...r,expiresAt:'2026-11-01T18:10:00Z',payments:[{id:'p',status:'rejected',rejectionReason:'Ilegible'}]}}));
  assert.match(rejected,/reenvío.*no está habilitado/); assert.doesNotMatch(rejected,/Continuar al pago/);
  const live=renderToStaticMarkup(await card.ReservationCard({reservation:{...r,expiresAt:'2026-11-01T18:10:00Z'}}));
  assert.match(live,/Continuar al pago/);
});
test('all migration files load from this checkout; receipt tests need no remote branch',async()=>{
  const source=await readFile(new URL('./reservations/receipts.test.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/execFileSync|origin\/feature\/operations/);
  const names=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(x=>x.endsWith('.sql')).sort();
  assert.equal(new Set(names.map(n=>n.split('_')[0])).size,names.length);
  for(const [before,after] of [['20261005155117','20261005180000'],['20261006000200','20261007182818'],['20261007182818','20261008003300'],['20261008000000','20261008003300']]) {
    assert.ok(names.findIndex(n=>n.startsWith(before))<names.findIndex(n=>n.startsWith(after)));
  }
});
