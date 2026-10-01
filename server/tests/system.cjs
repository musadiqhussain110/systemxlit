require('./requireTestDatabase.cjs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { connectDatabase, closeDatabase } = require('../src/config/db');
const { Department } = require('../src/models/Department');
const { Lab } = require('../src/models/Lab');
const { Equipment } = require('../src/models/Equipment');
const { Booking } = require('../src/models/Booking');
const { IssueRecord } = require('../src/models/IssueRecord');
const { BookingRule } = require('../src/models/BookingRule');
const { Notification } = require('../src/models/Notification');
const { runReminders } = require('../src/jobs/reminderJob');
const { app } = require('../src/app');
let count=0;
async function check(name,fn){
 if(process.env.TEST_BROWSER_ONLY==='1' && !/Initial administrator|Student and faculty|Browser booking|Every role/.test(name)) return;
 await fn();console.log('PASS',name);count++;
}
async function main(){
 await connectDatabase();
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const tokens={},users={};const password='WorkflowTest123!';let vite,browser,testPage;
 async function request(role,endpoint,method='GET',body,status=200){
  const r=await fetch(base+endpoint,{method,headers:{'Content-Type':'application/json',...(tokens[role]?{Authorization:`Bearer ${tokens[role]}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await r.json();assert.equal(r.status,status,`${method} ${endpoint}: ${data.message}`);return data;
 }
 try{
 await check('Initial administrator setup and repeated setup protection',async()=>{
  assert.equal((await request(null,'/auth/setup-status')).data.needsAdminSetup,true);
  const data=(await request(null,'/auth/setup-admin','POST',{name:'Test Admin',email:'admin@system.test',password},201)).data;tokens.admin=data.token;users.admin=data.user;
  await request(null,'/auth/setup-admin','POST',{name:'Second Admin',email:'second@system.test',password},409);
 });
 const dep=await Department.create({name:'Test Sciences',code:'TEST'});
 const lab=await Lab.create({name:'Workflow Lab',code:'LABTEST',department:dep._id,capacity:30,location:'Block A'});
 const equipment=await Equipment.create({name:'Workflow Kit',code:'KITTEST',category:'Electronics',department:dep._id,lab:lab._id,totalQuantity:8});
 await BookingRule.create({department:dep._id,minimumLeadHours:0,approvalRequired:true});
 await check('Student and faculty registration and login',async()=>{
  for(const role of ['student','faculty']){
   const data=(await request(null,'/auth/register','POST',{name:`Test ${role}`,email:`${role}@system.test`,password,role,department:dep._id,registrationNumber:role==='student'?'S-01':''},201)).data;users[role]=data.user;tokens[role]=data.token;
   const login=(await request(null,'/auth/login','POST',{email:`${role}@system.test`,password})).data;assert.equal(login.user.role,role);
   await request(null,'/auth/register','POST',{name:'Duplicate',email:`${role}@system.test`,password,role,department:dep._id,registrationNumber:'DUP'},409);
  }
  await request(null,'/auth/login','POST',{email:'student@system.test',password:'Incorrect123!'},401);
  await request(null,'/bookings','GET',undefined,401);
 });
 for(const role of ['labStaff','coordinator']){
  users[role]=(await request('admin','/users','POST',{name:`Test ${role}`,email:`${role}@system.test`,password,role,department:dep._id},201)).data;
  tokens[role]=(await request(null,'/auth/login','POST',{email:`${role}@system.test`,password})).data.token;
 }
 const day=new Date();day.setDate(day.getDate()+2);const bookingDate=day.toISOString().slice(0,10);
 const payload={department:dep._id,lab:lab._id,equipmentItems:[{equipment:equipment._id,quantity:2}],bookingDate,startTime:'10:00',endTime:'11:00',capacity:'2',purpose:'Academic workflow test'};
 await check('Booking validation identifies the failing field',async()=>{
  for(const [change,field] of [[{purpose:'lab'},'purpose'],[{bookingDate:'2026-02-30'},'bookingDate'],[{bookingDate:''},'bookingDate'],[{capacity:'0'},'capacity'],[{startTime:'25:00'},'startTime'],[{department:''},'department']]){
   const error=await request('student','/bookings','POST',{...payload,...change},400);assert.ok(error.details.issues.some(x=>x.field===field));assert.ok(error.message.includes(field));assert.notEqual(error.message,'Validation failed');
  }
  await request('student','/bookings','POST',{...payload,startTime:'12:00',endTime:'11:00'},400);
 });
 let booking;
 await check('Valid browser-style booking is accepted and visible in history',async()=>{
  booking=(await request('student','/bookings','POST',payload,201)).data;assert.equal(booking.status,'pendingApproval');assert.equal(booking.bookingDate,bookingDate);
  assert.ok((await request('student','/bookings')).data.some(x=>x._id===booking._id));
 });
 await check('Review, issue and good return work through the API',async()=>{
  assert.equal((await request('labStaff',`/bookings/${booking._id}/decision`,'PATCH',{decision:'approved'})).data.status,'reserved');
  await request('labStaff',`/issues/${booking._id}/issue`,'POST',{},201);
  await request('labStaff',`/issues/${booking._id}/return`,'PATCH',{items:[{equipment:equipment._id,returnCondition:'good'}]});
  assert.equal((await Booking.findById(booking._id)).status,'completed');
 });
 await check('Cancellation, rejection, and equipment-only booking work',async()=>{
  const a=(await request('faculty','/bookings','POST',{...payload,lab:null},201)).data;
  await request('faculty',`/bookings/${a._id}/cancel`,'PATCH',{});
  const b=(await request('student','/bookings','POST',{...payload,equipmentItems:[]},201)).data;
  await request('coordinator',`/bookings/${b._id}/decision`,'PATCH',{decision:'rejected',reason:'Test rejection'});
  assert.equal((await Booking.findById(a._id)).status,'cancelled');assert.equal((await Booking.findById(b._id)).status,'rejected');
 });
 await check('Notification read, ownership and mark-all-read work',async()=>{
  const rows=(await request('student','/notifications')).data;assert.ok(rows.length>=3);
  await request('faculty',`/notifications/${rows[0]._id}/read`,'PATCH',{},404);
  await request('student',`/notifications/${rows[0]._id}/read`,'PATCH',{});
  await request('student','/notifications/read-all','PATCH',{});
  assert.ok((await request('student','/notifications')).data.every(x=>x.readAt));
 });
 await check('Reminders and overdue transitions are recorded without duplicates',async()=>{
  const now=new Date();const soon=new Date(now.getTime()+30*60000);
  const { capacity, ...storedPayload } = payload;
  const localDay=`${soon.getFullYear()}-${String(soon.getMonth()+1).padStart(2,'0')}-${String(soon.getDate()).padStart(2,'0')}`;
  const near=await Booking.create({...storedPayload,user:users.student._id,bookingDate:localDay,startTime:`${String(soon.getHours()).padStart(2,'0')}:${String(soon.getMinutes()).padStart(2,'0')}`,status:'reserved',approvalStatus:'approved'});
  const overdue=await Booking.create({...storedPayload,user:users.student._id,lab:null,status:'inUse',approvalStatus:'approved'});
  await IssueRecord.create({booking:overdue._id,items:[{equipment:equipment._id,quantity:1}],issuedBy:users.labStaff._id,issuedAt:now,dueAt:new Date(now.getTime()-60000)});
  await runReminders();await runReminders();assert.equal((await Booking.findById(overdue._id)).status,'overdue');assert.equal(await Notification.count({booking:overdue._id,type:'equipment-overdue'}),1);assert.equal(await Notification.count({booking:near._id,type:'booking-reminder'}),1);
  await request('labStaff',`/issues/${overdue._id}/return`,'PATCH',{items:[{equipment:equipment._id,returnCondition:'missing',damageNote:'Test missing kit'}]});
  assert.equal((await Equipment.findById(equipment._id)).maintenanceStatus,'maintenance');
 });
 // Real browser against the local frontend and the isolated MySQL-backed API.
 process.env.VITE_API_URL='/api';
 const { createServer }=await import(pathToFileURL(path.resolve(__dirname,'../../node_modules/vite/dist/node/index.js')).href);
 vite=await createServer({root:path.resolve(__dirname,'../../client'),configLoader:'runner',cacheDir:path.resolve(__dirname,'../../output/qa/vite-test-cache'),server:{host:'127.0.0.1',port:0,proxy:{'/api':{target:base.slice(0,-4),changeOrigin:true}}},logLevel:'error'});await vite.listen();
 let playwright;
 try { playwright=require('playwright'); }
 catch { playwright=require(process.env.PLAYWRIGHT_MODULE_PATH || path.join(require('node:os').homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
 browser=await playwright.chromium.launch({...(process.platform==='win32'?{channel:'msedge'}:{}),headless:true});
 const errors=[];const page=await browser.newPage();testPage=page;page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>console.log('BROWSER request failed',r.url(),r.failure()?.errorText));
 const web=`http://127.0.0.1:${vite.httpServer.address().port}`;
 await check('Browser booking form rejects short purpose and submits a valid request',async()=>{
  await page.goto(web+'/login');await page.getByLabel('Email',{exact:true}).fill('student@system.test');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
  await page.goto(web+'/book');await page.getByLabel('Department').selectOption(dep._id);await page.getByLabel('Lab (optional)').selectOption(lab._id);await page.getByLabel('Date',{exact:true}).fill(bookingDate);await page.getByLabel('Start',{exact:true}).fill('13:00');await page.getByLabel('End',{exact:true}).fill('14:00');await page.getByLabel('Purpose').fill('lab');
  await page.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await page.getByRole('alert').filter({hasText:'5–800'}).waitFor();
  await page.getByLabel('Purpose').fill('Browser test of lab booking');await page.getByRole('button',{name:'Submit request',exact:true}).click();await page.waitForURL('**/bookings');await page.getByText('Booking request submitted successfully.').waitFor();await page.getByText('Browser test of lab booking',{exact:true}).waitFor();
 });
 await check('Every role renders its permitted screens without runtime/API errors',async()=>{
  const screens={student:['dashboard','resources','bookings','notifications'],faculty:['dashboard','resources','bookings','notifications'],labStaff:['dashboard','manage-resources','bookings','operations','notifications'],coordinator:['dashboard','manage-resources','bookings','rules','analytics','notifications'],admin:['dashboard','manage-resources','bookings','users','analytics','activity','notifications']};
  for(const [role,paths] of Object.entries(screens)){
   const context=await browser.newContext();await context.addInitScript(token=>localStorage.setItem('lab_booking_token',token),tokens[role]);const tab=await context.newPage();tab.on('pageerror',e=>errors.push(e.message));
   for(const screen of paths){const failures=[];const onResponse=r=>{if(r.url().startsWith(web+'/api')&&r.status()>=400)failures.push(`${r.status()} ${r.url()}`)};tab.on('response',onResponse);await tab.goto(web+'/'+screen);await tab.locator('main h1').waitFor();await tab.waitForTimeout(2000);assert.equal(new URL(tab.url()).pathname,'/'+screen);assert.deepEqual(failures,[],`${role} ${screen}`);assert.equal(await tab.locator('.alert.error').count(),0,`${role} ${screen}`);tab.off('response',onResponse);}
   if(!['student','faculty'].includes(role)){assert.equal(await tab.getByRole('link',{name:'New Booking',exact:true}).count(),0);await tab.goto(web+'/book');await tab.waitForURL('**/dashboard');}
   await context.close();
  }
  assert.deepEqual(errors,[]);
 });
 console.log(`SYSTEM: ${count} checks passed, including browser checks.`);
 }catch(error){
  if(testPage){await testPage.screenshot({path:path.resolve(__dirname,'../../output/qa/workflow-failure.png'),fullPage:true});console.log('Browser diagnostics:',await testPage.locator('form').evaluateAll(forms=>forms.map(f=>({valid:f.checkValidity(),fields:[...f.elements].map(e=>({type:e.type,length:e.value?.length,validation:e.validationMessage})),text:f.innerText}))));}
  throw error;
 }finally{if(browser)await browser.close();if(vite)await vite.close();await new Promise(r=>server.close(r));await closeDatabase();}
}
main().catch(e=>{console.error(e);process.exitCode=1});

