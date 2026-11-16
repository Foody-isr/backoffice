// Opt-in loopback-only integration check. Start the API TestBrowserWorkspace
// and the Backoffice build on 19083; the test blocks all external requests.
const { chromium } = require(process.env.FOODY_BROWSER_PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.FOODY_COMMERCIAL_SAMPLE_DIR || fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'foody-commercial-browser-'));
fs.mkdirSync(output, {recursive:true});
const base = 'http://127.0.0.1:19082/api/v1/admin/foody-billing/documents';
const headers = {Authorization: 'Bearer commercial-browser-test', 'Content-Type':'application/json'};
(async()=>{
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 const context = await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>{if(location.origin !== 'http://127.0.0.1:19083') return;localStorage.setItem('foody_admin_token','commercial-browser-test');localStorage.setItem('foody_admin_user',JSON.stringify({id:7,role:'superadmin',full_name:'Foody Demo',email:'demo@example.invalid'}));});
 let failFirstList = true;
 await context.route('**/*', async route=>{
   const u=new URL(route.request().url());
   if (u.pathname === '/api/v1/admin/foody-billing/documents' && route.request().method() === 'GET' && failFirstList) { failFirstList = false; await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'commercial_document_unavailable'})}); return; }
   if (u.pathname.startsWith('/api/v1/')) {const response=await route.fetch({url:'http://127.0.0.1:19082'+u.pathname+u.search}); await route.fulfill({response});}
   else if(u.origin==='http://127.0.0.1:19083'||u.protocol==='blob:') await route.continue();
   else await route.abort();
 });
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto('http://127.0.0.1:19083/dashboard/features');
 await page.getByRole('button',{name:'Quotes & orders',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'The document list could not be refreshed.'}).waitFor();
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await page.getByText('No documents in this view.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'New quotation',exact:true}).click();
 await page.getByLabel('Document title',{exact:true}).fill('Foody Demo · Equipment and subscription');
 await page.getByRole('group',{name:'Customer / prospect',exact:true}).getByLabel('Company or contact name').fill('מסעדה לדוגמה');
 async function add(key){await page.getByRole('combobox',{name:/Catalogue item/}).selectOption(key);await page.getByRole('button',{name:'Add item',exact:true}).click();}
 const group = i => page.getByRole('group',{name:`Line ${i}`,exact:true});
 await add('tariff:victaMobile');await group(1).getByLabel('Quantity',{exact:true}).fill('2');await group(1).getByLabel(/Unit price \(ILS/).fill('1210');
 await add('module:restaurant');await group(2).getByLabel('Payment schedule').selectOption('prepaid');await group(2).getByLabel('Months covered').fill('24');await group(2).getByLabel(/Price per unit for the entire period/).fill('6000');
 await add('module:ordering');await group(3).getByLabel('Minimum commitment').fill('12');await group(3).getByLabel(/Price per unit \/ month/).fill('249');
 await add('tariff:virtualSetup');await group(4).getByLabel(/Unit price \(ILS/).fill('199');
 await add('tariff:physicalMonthly');await group(5).getByLabel('Quantity',{exact:true}).fill('2');await group(5).getByLabel(/Price per unit \/ month/).fill('49');
 await add('tariff:virtualMonthly');await group(6).getByLabel(/Price per unit \/ month/).fill('49');
 await add('tariff:virtualOverage');await group(7).getByLabel(/Price per usage unit/).fill('0.05');
 await page.getByLabel('Commercial terms',{exact:true}).fill('תנאים לדוגמה בלבד. ציוד בהזמנה; שירותים בהפעלה.');
 await page.getByRole('button',{name:'Calculate totals',exact:true}).click();
 await page.getByRole('heading',{name:'Each month',exact:true}).waitFor();
 const summary=await page.getByLabel('Calculated totals',{exact:true}).innerText();
 assert(summary.includes('10,170.42'));assert(summary.includes('467.28'));assert(summary.includes('12 monthly payments'));
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Draft saved. Prices and inclusions are preserved with this document.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Preview PDF',exact:true}).click();await page.getByRole('dialog',{name:'PDF preview'}).waitFor();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Download PDF',exact:true}).click();const dl=await downloadPromise;await dl.saveAs(path.join(output, 'Foody-browser-draft-he.pdf'));
 assert(fs.readFileSync(path.join(output, 'Foody-browser-draft-he.pdf')).subarray(0,5).toString()==='%PDF-');
 await page.getByRole('button',{name:'Close preview',exact:true}).click();
 await page.getByRole('button',{name:'Review & finalize',exact:true}).click();await page.getByRole('button',{name:'Finalize document',exact:true}).click();
 await page.getByRole('button',{name:'View archived PDF',exact:true}).waitFor();
 assert(await page.getByLabel('Document title',{exact:true}).isDisabled());
 let documents=(await (await fetch(base,{headers})).json()).documents;assert.equal(documents.length,1);assert.equal(documents[0].status,'issued');
 const issued=documents[0];const first=Buffer.from(await (await fetch(`${base}/${issued.id}/pdf`,{headers})).arrayBuffer());const second=Buffer.from(await (await fetch(`${base}/${issued.id}/pdf`,{headers})).arrayBuffer());assert.deepEqual(first,second);
 fs.writeFileSync(path.join(output, 'Foody-browser-issued-quote-he.pdf'),first);
 await page.getByRole('button',{name:'Create order draft',exact:true}).click();await page.getByText('Order draft opened with the quotation’s prices and inclusions. Review it before finalizing.',{exact:true}).waitFor();
 documents=(await (await fetch(base,{headers})).json()).documents;assert.equal(documents.length,2);const order=documents.find(d=>d.kind==='order');assert(order);assert.equal(order.status,'draft');
 // A concurrent save cannot be silently overwritten by the browser's stale revision.
 const view=await(await fetch(`${base}/${order.id}`,{headers})).json();
 const conflict = await fetch(`${base}/${order.id}`,{method:'PUT',headers,body:JSON.stringify({document_id:order.id,expected_revision:order.revision,document:{...view.content,title:'Updated by a second operator'}})});assert.equal(conflict.status,200);
 await page.getByLabel('Document title',{exact:true}).fill('Unsaved edit must be preserved');await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByRole('alert').filter({hasText:'Your edits are still here'}).waitFor();assert.equal(await page.getByLabel('Document title',{exact:true}).inputValue(),'Unsaved edit must be preserved');
 await page.getByRole('button',{name:'Close editor',exact:true}).click();
 await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('button',{name:'Open Updated by a second operator',exact:true}).click();
 await page.getByRole('button',{name:'Review & finalize',exact:true}).click();await page.getByRole('button',{name:'Finalize document',exact:true}).click();await page.getByRole('button',{name:'View archived PDF',exact:true}).waitFor();
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:path.join(output, 'backoffice-documents-desktop.png')});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:path.join(output, 'backoffice-documents-mobile.png')});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile layout must not overflow horizontally');
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS: mixed draft, authoritative totals, Hebrew PDF preview/download, immutable numbered archive, order conversion, conflict recovery, desktop/mobile layout; no JavaScript errors.');
})().catch(e=>{console.error(e);process.exit(1)});
