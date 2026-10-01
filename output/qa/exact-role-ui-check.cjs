const { chromium } = require('C:/Users/Acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const access = {
 student:['dashboard','resources','book','bookings','notifications'],
 faculty:['dashboard','resources','book','bookings','notifications'],
 labStaff:['dashboard','bookings','operations','notifications','manage-resources'],
 coordinator:['dashboard','bookings','notifications','manage-resources','analytics','rules'],
 admin:['dashboard','bookings','notifications','manage-resources','analytics','users','activity'],
};
const routes=['dashboard','resources','book','bookings','notifications','operations','manage-resources','analytics','rules','users','activity'];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try { await Promise.all(Object.entries(access).filter(([role])=>!process.argv[2] || role === process.argv[2]).map(async([role,allowed])=>{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const user={_id:'user',name:'Role Preview',role,department:{_id:'department',name:'Computer Science'}};
  await context.addInitScript(()=>localStorage.setItem('lab_booking_token','role-preview'));
  const page=await context.newPage();const errors=[];const requests=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost:5000/api/**',route=>{
   const path=new URL(route.request().url()).pathname; requests.push(path);
   const data=path==='/api/auth/me'?user
    :path==='/api/analytics/summary'?{totals:{},mostBookedLabs:[]}
    :path==='/api/bookings'?[{_id:'booking',department:user.department,user:{_id:role==='faculty'?'user':role==='student'?'user':'student',name:'Requester'},lab:{_id:'lab',name:'Test lab'},bookingDate:'2026-10-03',startTime:'10:00',endTime:'12:00',purpose:'Academic testing',priority:'normal',status:'pendingApproval',approvalStatus:'pending'}]
    :path==='/api/resources/labs'?[{_id:'lab',code:'L001',name:'Test lab',department:user.department,capacity:20,location:'Block A',status:'available',availableForSlot:true,facilities:[],availableSlots:[]}]
    :path==='/api/resources/equipment'?[{_id:'equipment',name:'Test kit',code:'E001',department:user.department,category:'Electronics',totalQuantity:3,maintenanceStatus:'operational',condition:'good',lab:{_id:'lab'}}]
    :path==='/api/resources/departments'?[user.department]
    :path==='/api/resources/categories'?[{_id:'category',name:'Electronics',code:'ELEC'}]
    :[];
   return route.fulfill({json:{success:true,data}});
  });
  await page.goto('http://localhost:5173/dashboard');await page.getByRole('heading',{name:'Good day, Role'}).waitFor();
  const nav=page.getByRole('navigation',{name:'Workspace navigation'});
  const links=await nav.locator('a').evaluateAll(links=>links.map(link=>link.getAttribute('href').slice(1)));
  assert.deepEqual(links.sort(),[...allowed].sort(),`${role} exact navigation`);
  for(const path of routes){
   await page.goto(`http://localhost:5173/${path}`);
   if(!allowed.includes(path)){await page.waitForURL('**/dashboard');await page.getByRole('heading',{name:'Good day, Role'}).waitFor();}
   else {
    await page.locator('h1').waitFor();
    if(path==='bookings'){
     assert.equal(await page.getByRole('button',{name:'Review',exact:true}).count(),['labStaff','coordinator'].includes(role)?1:0);
     assert.equal(await page.getByRole('button',{name:'Cancel',exact:true}).count(),['student','faculty'].includes(role)?1:0);
     if(['labStaff','coordinator'].includes(role)){
      await page.getByRole('button',{name:'Review',exact:true}).click();
      assert.equal(await page.getByLabel('Priority level').count(),role==='coordinator'?1:0);
      assert.equal(await page.getByRole('button',{name:'Check conflicts'}).count(),role==='coordinator'?1:0);
      await page.keyboard.press('Escape');
     }
    }
    if(path==='manage-resources'){
     assert.equal(await page.getByRole('button',{name:'equipment',exact:true}).count(),role==='labStaff'?1:0);
     assert.equal(await page.getByRole('button',{name:'departments',exact:true}).count(),role==='admin'?1:0);
     assert.equal(await page.getByRole('button',{name:'categories',exact:true}).count(),role==='admin'?1:0);
     assert.equal(await page.getByRole('button',{name:'+ Add laboratory'}).count(),['admin','coordinator'].includes(role)?1:0);
     await page.getByRole('button',{name:'Edit',exact:true}).first().click();
     assert.equal(await page.getByLabel('Name',{exact:true}).isDisabled(),role==='labStaff');
     await page.keyboard.press('Escape');
    }
    if(path==='users'){
      await page.getByRole('button',{name:'+ Add user'}).click();
      const expected={student:8,faculty:8,labStaff:8,coordinator:6,admin:7};
      for(const [assigned,count] of Object.entries(expected)){await page.getByLabel('Role',{exact:true}).selectOption(assigned);assert.equal(await page.locator('.role-permission-preview li').count(),count);}
      await page.keyboard.press('Escape');
    }
   }
  }
  assert.deepEqual(errors,[],`${role} runtime errors`);
  if(!['admin','coordinator'].includes(role)) assert.ok(!requests.includes('/api/analytics/summary'),`${role} must not request analytics`);
  if(['admin','coordinator'].includes(role)) assert.ok(!requests.includes('/api/resources/equipment'),`${role} must not request equipment management data`);
  console.log(`PASS ${role}: exact navigation, 11 direct routes, actions, scope controls, no runtime errors`);
  await context.close();
 })); } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
