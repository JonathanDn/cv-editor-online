import { test, expect } from '@playwright/test';

const USER_ID = 'u1';

const apiHeaders = {
  'content-type': 'application/json',
  'x-user-id': USER_ID
};

const createCv = async (page, overrides = {}) => {
  return page.evaluate(async ({ headers, payload }) => {
    const res = await fetch('/api/cvs', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    return json.data;
  }, {
    headers: apiHeaders,
    payload: {
      title: 'E2E CV',
      content_json: { html: '<h2>CV Editor</h2><p>Seed content</p>' },
      ...overrides
    }
  });
};

const saveManualSnapshot = async (page, cv) => {
  return page.evaluate(async ({ headers, id, revision }) => {
    const res = await fetch(`/api/cvs/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        content_json: { html: '<h2>CV Editor</h2><p>Snapshot content</p>' },
        content_text: 'CV Editor Snapshot content',
        updated_at: revision,
        save_reason: 'manual_save'
      })
    });
    const json = await res.json();
    return json.data;
  }, { headers: apiHeaders, id: cv.id, revision: cv.updatedAt });
};

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('shows My CVs heading and status tabs', async ({ page }) => {
  await page.getByRole('button', { name: 'My CVs' }).click();
  await expect(page.getByRole('heading', { name: 'My CVs' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Active' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Archived' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Deleted' })).toBeVisible();
});

test('shows duplicate action when list has rows', async ({ page }) => {
  await createCv(page, { title: 'Duplicate Target' });
  await page.getByRole('button', { name: 'My CVs' }).click();
  await expect(page.getByRole('button', { name: 'Duplicate' }).first()).toBeVisible();
});

test('switching to deleted tab shows restore action for deleted CV', async ({ page }) => {
  const created = await createCv(page, { title: 'Delete then restore' });

  await page.evaluate(async ({ id, userId }) => {
    await fetch(`/api/cvs/${id}/delete`, { method: 'POST', headers: { 'x-user-id': userId } });
  }, { id: created.id, userId: USER_ID });

  await page.getByRole('button', { name: 'My CVs' }).click();
  await page.getByRole('button', { name: 'Deleted' }).click();
  await expect(page.getByRole('button', { name: 'Restore' }).first()).toBeVisible();
});

test('editor save status is visible for a valid CV id', async ({ page }) => {
  const created = await createCv(page, { title: 'Editor CV' });
  await page.goto(`/?id=${created.id}`);
  await expect(page.locator('.editor-toolbar small')).toContainText('Saved');
});

test('autosave keeps status visible after editing', async ({ page }) => {
  const created = await createCv(page, { title: 'Autosave CV' });
  await page.goto(`/?id=${created.id}`);

  const doc = page.locator('.cv-document');
  const status = page.locator('.editor-toolbar small');

  await doc.click();
  await page.keyboard.type(' Autosave smoke text');

  await expect(status).toContainText(/Saved|Saving…/);
  await page.waitForTimeout(7600);
  await expect(status).toContainText('Saved');
});

test('editor autosave shows conflict modal on stale revision conflict', async ({ page }) => {
  await page.route('**/api/cvs/conflict-cv', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'conflict-cv',
            title: 'CV',
            content_json: { html: '<h2>CV Editor</h2>' },
            updatedAt: '2026-05-01T00:00:00.000Z',
            revision: '2026-05-01T00:00:00.000Z'
          }
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
          message: 'This CV changed elsewhere. Reload latest version.'
        })
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/?id=conflict-cv');
  const doc = page.locator('.cv-document');
  const status = page.locator('.helper-text').last();

  await doc.click();
  await page.keyboard.type('Autosave conflict text');
  await page.waitForTimeout(7600);

  const conflictModal = page.getByTestId('conflict-reload-modal');
  await expect(conflictModal).toBeVisible();
  await expect(conflictModal.getByRole('heading', { name: 'Version conflict detected' })).toBeVisible();
  await expect(conflictModal).toContainText('This CV changed elsewhere. Reload latest version.');
  await expect(page.getByTestId('conflict-reload-action')).toHaveText('Reload latest version');
  await expect(page.getByTestId('conflict-close-action')).toBeVisible();
  await expect(status).toContainText('Unsaved changes');
});

test('snapshot modal opens from editor', async ({ page }) => {
  const created = await createCv(page, { title: 'Snapshot CV' });
  await page.goto(`/?id=${created.id}`);
  await page.getByRole('button', { name: 'Snapshots' }).click();
  await expect(page.getByRole('heading', { name: 'Snapshots' })).toBeVisible();
});

test('snapshot restore creates optional pre-restore snapshot and shows success', async ({ page }) => {
  const created = await createCv(page, { title: 'Snapshot Restore CV' });
  await saveManualSnapshot(page, created);
  await page.goto(`/?id=${created.id}`);
  await page.getByRole('button', { name: 'Snapshots' }).click();

  let dialogMessage = '';
  page.once('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Restore selected snapshot' }).first().click();
  expect(dialogMessage).toContain('Create a pre_restore snapshot before restoring?');

  await expect(page.locator('.error-text')).toContainText('Snapshot restored successfully.');
});

test('unsaved navigation shows confirmation dialog', async ({ page }) => {
  const created = await createCv(page, { title: 'Confirm Nav CV' });
  await page.goto(`/?id=${created.id}`);

  let dialogMessage = '';
  page.once('dialog', async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.accept();
  });
  await page.locator('.cv-document').click();
  await page.keyboard.type(' unsaved text');
  await page.getByRole('button', { name: 'My CVs' }).click();

  expect(dialogMessage).toContain('You have unsaved changes');
});

test('My CVs page keeps empty-state CTA visible when filtered list is empty', async ({ page }) => {
  await page.getByRole('button', { name: 'My CVs' }).click();
  await page.getByPlaceholder('Filter by tag').fill('missing-e2e-tag');
  await expect(page.getByRole('button', { name: 'Create your first CV' }).first()).toBeVisible();
});
