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

test('editor autosave updates status indicator', async ({ page }) => {
  await page.goto('/?id=1');
  const doc = page.locator('.cv-document');
  const status = page.locator('.editor-toolbar small');
  await expect(status).toContainText('Saved');

  await doc.click();
  await page.keyboard.type('Autosave signal text');
  await expect(status).toContainText('Saved');

  await page.waitForTimeout(7600);
  await expect(status).toContainText('Saved');
});


test('conflict modal uses stable test ids', async ({ page }) => {
  await page.goto('/?id=1');
  await page.getByRole('button', { name: 'Snapshots' }).click();
  await page.getByRole('button', { name: 'Restore snapshot' }).first().click();

  const conflictModal = page.getByTestId('conflict-reload-modal');
  await expect(conflictModal).toBeVisible();
  await expect(conflictModal.getByRole('heading', { name: 'Version conflict detected' })).toBeVisible();
  await expect(conflictModal).toContainText('A newer version is available. Reload to review and merge changes.');
  await expect(page.getByTestId('conflict-reload-action')).toBeVisible();
  await expect(page.getByTestId('conflict-close-action')).toBeVisible();

  await page.getByTestId('conflict-close-action').click();
  await expect(conflictModal).toHaveCount(0);
});
