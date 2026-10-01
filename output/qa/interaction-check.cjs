const { chromium } = require('C:/Users/Acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://localhost:5000/api/**',async route=>{const response=await route.fetch({url:route.request().url().replace(':5000',':5055')});await route.fulfill({response});});
 await page.goto('http://localhost:5173/login');await page.getByLabel('Email',{exact:true}).fill('admin@preview.test');await page.getByLabel('Password',{exact:true}).fill('Preview123!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
 await page.goto('http://localhost:5173/resources');await page.getByRole('link',{name:'Book this resource'}).first().click();await page.getByLabel('Lab (optional)').waitFor();assert.notEqual(await page.getByLabel('Lab (optional)').inputValue(),'');console.log('PASS resource card prefills lab');
 await page.goto('http://localhost:5173/manage-resources');await page.getByRole('button',{name:'+ Add laboratory'}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').getAttribute('aria-modal'),'true');await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);console.log('PASS dialog semantics and Escape');
 await page.goto('http://localhost:5173/operations');await page.getByRole('button',{name:'Issue now'}).first().click();await page.getByRole('button',{name:'Return',exact:true}).first().click();await page.getByRole('dialog').getByRole('button',{name:'Confirm return'}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.getByText('Return recorded successfully.').waitFor();console.log('PASS UI issue and return workflow');
 assert.deepEqual(errors,[]);console.log('PASS no runtime errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
