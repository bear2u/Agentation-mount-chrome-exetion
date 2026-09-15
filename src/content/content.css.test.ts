import { readFile } from 'node:fs/promises';

describe('annotation dialog styles', () => {
  it('accepts pointer events instead of inheriting the disabled extension host state', async () => {
    const styles = await readFile('src/content/content.css', 'utf8');

    expect(styles).toMatch(/\.dialog\s*\{[^}]*pointer-events:\s*auto;/s);
  });
});
