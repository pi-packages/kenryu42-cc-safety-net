import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { RULE_DOC } from '@/bin/rule/doc';
import { runSafetyNetCli, withTempDir } from '../helpers';

describe('rule command docs', () => {
  test('documents current rulebook configuration', () => {
    expect(RULE_DOC).toContain('.cc-safety-net/rules/rule.json');
    expect(RULE_DOC).toContain('.cc-safety-net/rules/<rulebook-name>/rulebook.json');
    expect(RULE_DOC).toContain('.cc-safety-net/cache/rulebooks/');
    expect(RULE_DOC).toContain('owner/repo#ref/<rulebook-name>');
    expect(RULE_DOC).toContain('allowed_commands');
    expect(RULE_DOC).toContain('tests');
    expect(RULE_DOC).toContain('overrides');
    expect(RULE_DOC).toContain('<rulebook-name>/<rule-name>');
    expect(RULE_DOC).not.toContain(
      'Agent reference for generating `.safety-net.json` config files.',
    );
  });

  test('prints rule docs', async () => {
    const result = await runSafetyNetCli(['rule', 'doc']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.output).toBe(`${RULE_DOC}\n`);
  });

  test('initializes project rules and sibling cache in the canonical layout', async () => {
    await withTempDir('safety-net-rule-init-', async (tempDir) => {
      const result = await runSafetyNetCli(
        ['rule', 'init'],
        { HOME: join(tempDir, 'home') },
        tempDir,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expectCanonicalRulesLayout(tempDir, 'project-rules');
    });
  });

  test('initializes global rules and sibling cache in the canonical layout', async () => {
    await withTempDir('safety-net-rule-init-global-', async (tempDir) => {
      const result = await runSafetyNetCli(['rule', 'init', '--global'], {
        CC_SAFETY_NET_HOME: join(tempDir, '.cc-safety-net'),
        HOME: join(tempDir, 'home'),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expectCanonicalRulesLayout(tempDir, 'user-rules');
    });
  });
});

function expectCanonicalRulesLayout(dir: string, rulebookName: string): void {
  expect(existsSync(join(dir, '.cc-safety-net', 'rules', 'rule.json'))).toBe(true);
  expect(existsSync(join(dir, '.cc-safety-net', 'rules', 'rule.lock'))).toBe(true);
  expect(existsSync(join(dir, '.cc-safety-net', 'rules', rulebookName, 'rulebook.json'))).toBe(
    true,
  );
  expect(existsSync(join(dir, '.cc-safety-net', 'cache', 'rulebooks'))).toBe(true);
  expect(existsSync(join(dir, '.cc-safety-net', 'rules', 'cache'))).toBe(false);
}
