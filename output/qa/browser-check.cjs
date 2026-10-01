const { chromium } = require('C:/Users/Acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
 const browser = await chromium.launch({ channel: 'msedge', headless:true });
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 await page.route('http://localhost:5000/api/**', async route => { const response = await route.fetch({url:route.request().url().replace(':5000', ':5055')}); await route.fulfill({response}); });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'output/qa/home-desktop.png',fullPage:true});
 await page.getByRole('link',{name:'Sign in',exact:true}).click();
 await page.screenshot({path:'output/qa/login-desktop.png',fullPage:true});
 await page.getByLabel('Email',{exact:true}).fill('admin@preview.test');
 await page.getByLabel('Password',{exact:true}).fill('Preview123!');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.waitForURL('**/dashboard',{timeout:15000});
 await page.getByRole('heading',{name:/Good day/}).waitFor();
 await page.screenshot({path:'output/qa/dashboard-desktop.png',fullPage:true});
 for(const route of ['resources','book','bookings','operations','analytics','manage-resources','rules','users','activity','notifications']) {
  await page.goto(`http://localhost:5173/${route}`);await page.locator('h1').waitFor();
  console.log('PAGE',route,await page.locator('h1').innerText());
 }
 await page.setViewportSize({width:390,height:844});
 for(const route of ['dashboard','resources','book','bookings']) {
  await page.goto(`http://localhost:5173/${route}`);await page.locator('h1').waitFor();
  console.log('MOBILE',route,await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth})));
  await page.screenshot({path:`output/qa/${route}-mobile.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Sign out'}).click();await page.goto('http://localhost:5173');await page.locator('h1').waitFor();
 await page.screenshot({path:'output/qa/home-mobile.png',fullPage:true});
 console.log('ERRORS',errors);await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
