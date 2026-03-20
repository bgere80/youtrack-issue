import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import process from 'node:process';

import { expect } from 'vitest';

const execFileAsync = promisify(execFile);
const debugCliTests = process.env.DEBUG_CLI_TESTS === '1';

export const repoRoot = process.cwd();
export const cliPath = path.join(repoRoot, 'bin', 'ytissue.mjs');
export const configPath = path.join(repoRoot, 'config.test.json');

export async function runCli(args, options = {}) {
  if (debugCliTests) {
    console.log(`\n[cli] ${process.execPath} ${[cliPath, ...args].join(' ')}`);
  }

  try {
    const result = await execFileAsync(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NO_COLOR: '1',
        ...options.env
      },
      timeout: options.timeout ?? 30_000
    });

    const response = {
      code: 0,
      stdout: result.stdout,
      stderr: result.stderr
    };

    if (debugCliTests) {
      console.log(`[exit] ${response.code}`);
      console.log(`[stdout]\n${response.stdout || '<empty>'}`);
      console.log(`[stderr]\n${response.stderr || '<empty>'}`);
    }

    return response;
  } catch (error) {
    const response = {
      code: error.code ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      error
    };

    if (debugCliTests) {
      console.log(`[exit] ${response.code}`);
      console.log(`[stdout]\n${response.stdout || '<empty>'}`);
      console.log(`[stderr]\n${response.stderr || '<empty>'}`);
    }

    return response;
  }
}

export function expectSuccess(result) {
  expect(result.code, `Expected success.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`).toBe(0);
}

export function expectFailure(result) {
  expect(result.code, `Expected failure.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`).not.toBe(0);
}
