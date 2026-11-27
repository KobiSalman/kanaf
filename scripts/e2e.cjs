// בדיקות מסכים אוטומטיות לכנף: עוברים על הזרימות העיקריות בדפדפן אמיתי.
// הרצה: node scripts/e2e.cjs http://localhost:3000
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const BASE = process.argv[2] || 'http://localhost:3000';
const OUT = process.env.E2E_OUT || '/tmp/e2e';
require('fs').mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, note = '') => { results.push({ name, pass, note }); console.log(`${pass ? '✓' : '✗'} ${name}${note ? ' · ' + note : ''}`); };

// טקסט חשוב שמשהו אחר מכסה: בודקים מה נמצא בנקודת האמצע של האלמנט
async function covered(page, selector) {
  return page.evaluate((sel) => {
    const bad = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
      const navTop = document.querySelector('.nav')?.getBoundingClientRect().top ?? innerHeight;
      const y = r.top + r.height / 2; if (y > navTop) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, y);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) bad.push(`${(el.textContent || '').trim().slice(0, 30)} ← ${hit.className || hit.tagName}`);
    }
    return bad;
  }, selector);
}

async function run(viewport, label) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
  const ctx = await browser.newContext({ viewport, geolocation: { latitude: 32.08, longitude: 34.78 }, permissions: ['geolocation'], locale: 'he-IL' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.googleapis|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  // בהרצה מקומית אין גישה לשערי מטבע ואין מפתח Aviationstack: אלה לא נספרים כשגיאה
  const localOnly = (u) => process.env.E2E_LOCAL && /\/api\/rate|\/api\/flight/.test(u);
  page.on('response', (r) => { if (r.status() >= 500 && r.url().includes('/api/') && !localOnly(r.url())) errors.push(`HTTP ${r.status()} ${r.url().replace(BASE, '')}`); });
  const shot = (n) => page.screenshot({ path: `${OUT}/${label}-${n}.png` });
  const step = async (name, fn) => { try { await fn(); } catch (e) { ok(`[${label}] ${name}`, false, e.message.split('\n')[0]); await shot('fail-' + name.replace(/\s+/g, '_')).catch(() => {}); return false; } return true; };

  await step('מסך פתיחה', async () => {
    await page.goto(BASE + '/');
    await page.getByText('לאן טסים?').first().waitFor({ timeout: 15000 });
    await page.locator('#destSearch').waitFor({ timeout: 15000 });
    ok(`[${label}] מסך פתיחה: "לאן טסים?" ושדה חיפוש`, true);
    const c = await covered(page, '.hero h1, .hero .pill, .brand-name');
    ok(`[${label}] מסך פתיחה: אין טקסט מכוסה`, !c.length, c.join(' | '));
    await shot('1-start');
  });
  await step('השלמה ובחירת טיסה', async () => {
    await page.fill('#destSearch', 'בנג');
    await page.getByRole('option', { name: /בנגקוק/ }).first().waitFor({ timeout: 10000 });
    ok(`[${label}] "בנג" משלים לבנגקוק`, true);
    await page.getByRole('option', { name: /בנגקוק/ }).first().click();
    await page.getByText('טיסות לבנגקוק').waitFor({ timeout: 10000 });
    const rowsLoc = page.locator('section.card.big button').filter({ hasText: /\d\d:\d\d/ });
    await rowsLoc.first().waitFor({ timeout: 15000 });
    const n = await rowsLoc.count();
    ok(`[${label}] רשימת טיסות לבנגקוק`, n > 0, `${n} טיסות`);
    await shot('2-flights');
    await rowsLoc.first().click();
    await page.locator('.bp-face').first().waitFor({ timeout: 20000 });
    ok(`[${label}] מעבר למסך הטיסה`, true);
    const c = await covered(page, '.hero h1, .bp-face .code, .bp-face .badge, .hero .pill');
    ok(`[${label}] מסך הטיסה: אין טקסט מכוסה`, !c.length, c.join(' | '));
    await shot('3-flight');
  });
  await step('מסך היעד', async () => {
    await page.getByText('טיפים ומידע על').first().click();
    await page.locator('.dest-hero2').waitFor({ timeout: 10000 });
    const cards = await Promise.all(['חטיפי מידע', 'איך מגיעים מהשדה', 'רגע לפני שטסים'].map((t) => page.getByText(t).first().isVisible()));
    ok(`[${label}] מסך היעד: חטיפי מידע, דרכי הגעה, מידע מעשי`, cards.every(Boolean), cards.join(','));
    const img = await page.waitForFunction(() => { const i = document.querySelector('.dest-flag2 img'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).then(() => true).catch(() => false);
    ok(`[${label}] מסך היעד: הדגל נטען`, img);
    await shot('4-dest');
    await page.getByRole('button', { name: /לטיסה שלי/ }).click();
  });
  for (const [tab, check] of [['בטיסה', null], ['לוח', 'עומס צפוי'], ['מעליי', null], ['מי טס', null]]) {
    await step(`לשונית ${tab}`, async () => {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await page.waitForTimeout(tab === 'מעליי' ? 6000 : 2500);
      if (check) await page.getByText(check).first().waitFor({ timeout: 10000 });
      const c = await covered(page, '.hero h1, .hero p, .hero .pill');
      ok(`[${label}] לשונית ${tab}: נטענה, אין טקסט מכוסה`, !c.length, c.join(' | '));
      if (tab === 'מעליי') {
        const map = await page.locator('svg[role="img"]').count();
        const busy = await page.getByText(/עמוס|לא הצלחנו/).count();
        ok(`[${label}] מעליי: מפה או הודעה ברורה`, map > 0 || busy > 0, map ? 'מפה' : 'הודעת עומס');
      }
      await shot('5-' + tab);
    });
  }
  await step('חיפוש לפי מספר', async () => {
    await page.getByRole('button', { name: 'טיסות', exact: true }).click();
    await page.getByRole('button', { name: /שנה טיסה/ }).click();
    await page.getByRole('button', { name: 'יש לי מספר טיסה' }).click();
    await page.fill('#flightNo', 'LY315');
    await page.fill('#flightDate', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(Date.now()));
    await page.getByRole('button', { name: 'חפש טיסה' }).click();
    await page.getByText('LY315').first().waitFor({ timeout: 20000 });
    ok(`[${label}] חיפוש לפי מספר טיסה (LY315)`, true);
  });
  await step('עמוד תנאים', async () => {
    await page.goto(BASE + '/terms');
    await page.getByText('מדיניות פרטיות').first().waitFor({ timeout: 10000 });
    ok(`[${label}] עמוד תנאי שימוש ופרטיות`, true);
  });
  ok(`[${label}] בלי שגיאות JavaScript או שרת`, !errors.length, errors.slice(0, 5).join(' | '));
  await browser.close();
}

(async () => {
  await run({ width: 360, height: 780 }, 'phone-small');
  await run({ width: 390, height: 844 }, 'phone');
  await run({ width: 1280, height: 900 }, 'desktop');
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} בדיקות עברו`);
  process.exit(failed.length ? 1 : 0);
})();
