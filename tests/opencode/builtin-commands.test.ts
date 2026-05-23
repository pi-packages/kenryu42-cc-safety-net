import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBuiltinCommands } from '@/opencode/builtin-commands/commands';

describe('builtin OpenCode commands', () => {
  test('uses the cc-safetynet-rules skill workflow as the command template', () => {
    const skill = readFileSync(join(process.cwd(), 'skills/cc-safetynet-rules/SKILL.md'), 'utf-8');

    expect(loadBuiltinCommands()['cc-safetynet-rules']?.template).toBe(
      skill.slice(skill.indexOf('## Workflow')),
    );
  });

  test('uses the current rulebook repository path', () => {
    const template = loadBuiltinCommands()['cc-safetynet-rules']?.template;

    expect(template).toContain('.cc-safetynet-rules/<rulebook-name>/rulebook.json');
    expect(template).not.toContain('`cc-safetynet-rules/<rulebook-name>/rulebook.json`');
  });
});
