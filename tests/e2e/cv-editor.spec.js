import { test, expect } from '@playwright/test';

const storageKey = 'cvEditorData';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => window.localStorage.removeItem(key), storageKey);
  await page.reload();
});

test('supports typing in editable fields', async ({ page }) => {
  const summary = page.locator('.hero-summary');
  await summary.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Typed summary from runtime test.');
  await expect(summary).toContainText('Typed summary from runtime test.');
});

test('sanitizes paste as plain text', async ({ page }) => {
  const summary = page.locator('.hero-summary');
  await summary.click();

  await page.evaluate(() => {
    const editable = document.querySelector('.cv-document');
    editable.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    const summary = document.querySelector('.hero-summary');
    range.selectNodeContents(summary);
    selection.removeAllRanges();
    selection.addRange(range);

    editable.dispatchEvent(new Event('input', { bubbles: true }));

    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: (type) => (type === 'text/plain' ? 'Safe text only' : '<b>Unsafe HTML</b>'),
      },
    });
    editable.dispatchEvent(event);
  });

  await expect(summary).toContainText('Safe text only');
  await expect(summary.locator('b')).toHaveCount(0);
});

test('enforces undo/redo stack limits', async ({ page }) => {
  const summary = page.locator('.hero-summary');

  for (let i = 1; i <= 55; i += 1) {
    await summary.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`state-${i}`);
  }

  for (let i = 0; i < 50; i += 1) {
    await page.keyboard.press('Control+Z');
  }

  await expect(summary).toContainText('state-5');
  await page.keyboard.press('Control+Z');
  await expect(summary).toContainText('state-5');

  await page.keyboard.press('Control+Shift+Z');
  await expect(summary).toContainText('state-6');
});

test('adds experience and left section panels', async ({ page }) => {
  const jobs = page.locator('.experience-container .panel .job');
  const leftSections = page.locator('.left-column .panel');

  await expect(jobs).toHaveCount(5);
  await page.getByRole('button', { name: 'Add Experience' }).click();
  await expect(jobs).toHaveCount(6);

  const beforeSections = await leftSections.count();
  await page.getByRole('button', { name: 'Add Left Section' }).click();
  await expect(leftSections).toHaveCount(beforeSections + 1);
  await expect(page.getByTestId('custom-left-section')).toBeVisible();
});

test('persists edits across reload', async ({ page }) => {
  const title = page.locator('.hero-title');
  await title.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Runtime Persistence Title');
  await expect(title).toContainText('Runtime Persistence Title');

  await page.reload();
  await expect(page.locator('.hero-title')).toContainText('Runtime Persistence Title');
});

test('hides toolbar controls during print mode', async ({ page }) => {
  const controls = page.locator('.history-controls');
  await expect(controls).toBeVisible();

  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await expect(controls).toHaveCount(0);

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('.history-controls')).toBeVisible();
});

test('My CVs renders and duplicate action is visible', async ({ page }) => {
  await page.getByRole('button', { name: 'My CVs' }).click();
  await expect(page.getByRole('heading', { name: 'My CVs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Duplicate' }).first()).toBeVisible();
});

test('editor autosave shows conflict modal on stale revision conflict', async ({ page }) => {
  await page.route('**/api/cvs/1', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { id: '1', title: 'CV', content_json: { html: '<h2>CV Editor</h2>' }, updatedAt: '2026-05-01T00:00:00.000Z', revision: '2026-05-01T00:00:00.000Z' }
        })
      });
      return;
    }
    if (req.method() === 'PUT') {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Conflict',
          code: 'CV_CONFLICT',
          guidance: 'Please refresh/reload to get the latest version before saving.',
          latest: { updated_at: '2026-05-01T00:00:05.000Z', revision: '2026-05-01T00:00:05.000Z' }
        })
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/?id=1');
  const doc = page.locator('.cv-document');
  const status = page.locator('.helper-text').last();

  await doc.click();
  await page.keyboard.type('Autosave conflict text');
  await page.waitForTimeout(7600);

  await expect(page.getByRole('heading', { name: 'Conflict detected' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
  await expect(page.locator('.helper-text')).not.toContainText('All changes saved');
  await expect(status).toContainText('Unsaved changes');
});
