const { chromium } = require('C:/Users/Acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  for (const role of ['admin','coordinator','labStaff','student','faculty']) {
   const context = await browser.newContext();
   await context.addInitScript(() => localStorage.setItem('lab_booking_token','role-preview'));
   const page = await context.newPage();
   await page.route('http://localhost:5000/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === '/api/auth/me' ? {_id:'user',name:'Role Preview',role,department:{_id:'department',name:'Computer Science'}}
      : path === '/api/analytics/summary' ? {totals:{},mostBookedLabs:[]}
      : path === '/api/resources/labs' ? [{_id:'lab',name:'Test lab',department:{_id:'department',name:'Computer Science'},capacity:20,status:'available',availableForSlot:true}]
      : [];
    return route.fulfill({json:{success:true,data}});
   });
   await page.goto('http://localhost:5173/dashboard');
   await page.getByRole('heading',{name:'Good day, Role'}).waitFor();
   const canBook = ['student','faculty'].includes(role);
   assert.equal(await page.getByRole('link',{name:'New Booking',exact:true}).count(),canBook?1:0);
   assert.equal(await page.getByRole('link',{name:'+ New booking',exact:true}).count(),canBook?1:0);
   assert.equal(await page.getByRole('link',{name:'Booking Requests',exact:true}).count(),canBook?0:1);
   await page.getByRole('link',{name:'Resources',exact:true}).click();
   await page.getByRole('heading',{name:'Test lab'}).waitFor();
   assert.equal(await page.getByRole('link',{name:'Book this resource'}).count(),canBook?1:0);
   await page.goto('http://localhost:5173/book');
   if(canBook) await page.getByRole('heading',{name:'Create a booking'}).waitFor();
   else {await page.waitForURL('**/dashboard');await page.getByRole('heading',{name:'Good day, Role'}).waitFor();}
   console.log(`PASS ${role}: navigation, resource actions, and direct booking route`);
   await context.close();
  }
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
