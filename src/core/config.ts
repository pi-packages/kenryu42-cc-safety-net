import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  COMMAND_PATTERN,
  type Config,
  MAX_REASON_LENGTH,
  NAME_PATTERN,
  type ValidationResult,
} from '@/types';
import { validateRulesConfig } from './rules/policy/config-file';
import { loadRulesPolicy, rulesPolicyToConfig } from './rules/policy/scope-policy';
import { repairLocalRulesPolicy } from './rules/policy/sync';

export interface LoadConfigOptions {
  /** Override user config directory (for testing) */
  userConfigDir?: string;
  /** Repair local rulebook lock/cache state before loading rule-backed rules. */
  repairLocalRulebooks?: boolean;
}

export function loadConfig(cwd?: string, options?: LoadConfigOptions): Config {
  const safeCwd = typeof cwd === 'string' ? cwd : process.cwd();
  if (options?.repairLocalRulebooks) {
    repairLocalRulesPolicy({ cwd: safeCwd, userConfigDir: options.userConfigDir });
  }
  return rulesPolicyToConfig(
    loadRulesPolicy({ cwd: safeCwd, userConfigDir: options?.userConfigDir }),
  );
}

/** @internal Exported for testing */
export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const ruleNames = new Set<string>();

  if (!config || typeof config !== 'object') {
    errors.push('Config must be an object');
    return { errors, ruleNames };
  }

  const cfg = config as Record<string, unknown>;

  if (cfg.version !== 1) {
    errors.push('version must be 1');
  }

  if (cfg.rules !== undefined) {
    if (!Array.isArray(cfg.rules)) {
      errors.push('rules must be an array');
    } else {
      for (let i = 0; i < cfg.rules.length; i++) {
        const rule = cfg.rules[i] as unknown;
        const ruleErrors = validateRule(rule, i, ruleNames);
        errors.push(...ruleErrors);
      }
    }
  }

  return { errors, ruleNames };
}

function validateRule(rule: unknown, index: number, ruleNames: Set<string>): string[] {
  const errors: string[] = [];
  const prefix = `rules[${index}]`;

  if (!rule || typeof rule !== 'object') {
    errors.push(`${prefix}: must be an object`);
    return errors;
  }

  const r = rule as Record<string, unknown>;

  if (typeof r.name !== 'string') {
    errors.push(`${prefix}.name: required string`);
  } else {
    if (!NAME_PATTERN.test(r.name)) {
      errors.push(
        `${prefix}.name: must match pattern (letters, numbers, hyphens, underscores; max 64 chars)`,
      );
    }
    const lowerName = r.name.toLowerCase();
    if (ruleNames.has(lowerName)) {
      errors.push(`${prefix}.name: duplicate rule name "${r.name}"`);
    } else {
      ruleNames.add(lowerName);
    }
  }

  if (typeof r.command !== 'string') {
    errors.push(`${prefix}.command: required string`);
  } else if (!COMMAND_PATTERN.test(r.command)) {
    errors.push(`${prefix}.command: must match pattern (letters, numbers, hyphens, underscores)`);
  }

  if (r.subcommand !== undefined) {
    if (typeof r.subcommand !== 'string') {
      errors.push(`${prefix}.subcommand: must be a string if provided`);
    } else if (!COMMAND_PATTERN.test(r.subcommand)) {
      errors.push(
        `${prefix}.subcommand: must match pattern (letters, numbers, hyphens, underscores)`,
      );
    }
  }

  if (!Array.isArray(r.block_args)) {
    errors.push(`${prefix}.block_args: required array`);
  } else {
    if (r.block_args.length === 0) {
      errors.push(`${prefix}.block_args: must have at least one element`);
    }
    for (let i = 0; i < r.block_args.length; i++) {
      const arg = r.block_args[i];
      if (typeof arg !== 'string') {
        errors.push(`${prefix}.block_args[${i}]: must be a string`);
      } else if (arg === '') {
        errors.push(`${prefix}.block_args[${i}]: must not be empty`);
      }
    }
  }

  if (typeof r.reason !== 'string') {
    errors.push(`${prefix}.reason: required string`);
  } else if (r.reason === '') {
    errors.push(`${prefix}.reason: must not be empty`);
  } else if (r.reason.length > MAX_REASON_LENGTH) {
    errors.push(`${prefix}.reason: must be at most ${MAX_REASON_LENGTH} characters`);
  }

  return errors;
}

export function validateConfigFile(path: string): ValidationResult {
  return validateParsedConfigFile(path, validateConfig);
}

type ConfigFileInput = { ok: true; parsed: unknown } | { ok: false; result: ValidationResult };

function readConfigFileInput(path: string): ConfigFileInput {
  const errors: string[] = [];
  const ruleNames = new Set<string>();

  if (!existsSync(path)) {
    errors.push(`File not found: ${path}`);
    return { ok: false, result: { errors, ruleNames } };
  }

  try {
    const content = readFileSync(path, 'utf-8');
    if (!content.trim()) {
      errors.push('Config file is empty');
      return { ok: false, result: { errors, ruleNames } };
    }

    return { ok: true, parsed: JSON.parse(content) as unknown };
  } catch (e) {
    errors.push(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, result: { errors, ruleNames } };
  }
}

export function getLegacyProjectConfigPath(cwd?: string): string {
  return resolve(cwd ?? process.cwd(), '.safety-net.json');
}

export function validateRulesConfigFile(path: string): ValidationResult {
  const loaded = readConfigFileInput(path);
  if (!loaded.ok) return loaded.result;
  const result = validateRulesConfig(loaded.parsed);
  return { errors: result.errors, ruleNames: result.sources };
}

function validateParsedConfigFile(
  path: string,
  validate: (config: unknown) => ValidationResult,
): ValidationResult {
  const loaded = readConfigFileInput(path);
  if (!loaded.ok) return loaded.result;
  return validate(loaded.parsed);
}

export type { ValidationResult };
