#!/usr/bin/env node

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import {
  PROMPT_REGISTRY,
  renderPrompt,
  copyToClipboard,
  getGitContext
} from './prompt-manager-lib.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

function printUsage() {
  console.log('TradeOS Prompt Manager (CLI)');
  console.log('============================');
  console.log('Usage:');
  console.log('  node scripts/prompt-manager.mjs list');
  console.log('  node scripts/prompt-manager.mjs show <prompt-id>');
  console.log('  node scripts/prompt-manager.mjs render <prompt-id> [--key=value ...]');
  console.log('  node scripts/prompt-manager.mjs copy <prompt-id> [--key=value ...]');
  console.log('  node scripts/prompt-manager.mjs interactive (or: npm run prompt)');
  console.log('');
  console.log('Examples:');
  console.log('  npm run prompt list');
  console.log('  npm run prompt copy startup');
  console.log('  npm run prompt copy backend --FEATURE_NAME="Job Assignments" --PERMISSION_KEY="jobs.write"');
  console.log('  npm run prompt copy bugfix --MODULE_NAME="AuthService" --BUG_DESCRIPTION="409 on second login"');
  console.log('');
}

function parseCliArgs(args) {
  const flags = {};
  const positional = [];

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const parts = arg.slice(2).split('=');
      const key = parts[0];
      const val = parts.slice(1).join('=') || 'true';
      flags[key] = val;
    } else {
      positional.push(arg);
    }
  }

  return { positional, flags };
}

function listPrompts() {
  console.log('');
  console.log('--- Available TradeOS Prompts ---');
  console.log('');
  const grouped = {};

  for (const item of Object.values(PROMPT_REGISTRY)) {
    grouped[item.category] = grouped[item.category] || [];
    grouped[item.category].push(item);
  }

  for (const [category, items] of Object.entries(grouped)) {
    console.log(`📁 ${category}`);
    for (const p of items) {
      console.log(`   • ${p.id.padEnd(18)} : ${p.title} [${p.targetAgents.join(', ')}]`);
    }
    console.log('');
  }
}

function showPrompt(promptId) {
  const item = PROMPT_REGISTRY[promptId];
  if (!item) {
    console.error(`❌ Prompt "${promptId}" not found. Run 'npm run prompt list' to see available IDs.`);
    process.exit(1);
  }

  console.log('');
  console.log('==================================================');
  console.log(`ID: ${item.id}`);
  console.log(`Title: ${item.title}`);
  console.log(`Category: ${item.category}`);
  console.log(`Target Agents: ${item.targetAgents.join(', ')}`);
  console.log(`Description: ${item.description}`);
  console.log('==================================================');
  console.log('');
  console.log('Variables:');
  for (const [key, cfg] of Object.entries(item.variables)) {
    console.log(`  - {{${key}}}: ${cfg.description} (default: "${cfg.default}")`);
  }
  console.log('');
  console.log('Template:');
  console.log('--------------------------------------------------');
  console.log(item.template);
  console.log('--------------------------------------------------');
  console.log('');
}

async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (q) => new Promise((res) => rl.question(q, res));

  console.log('');
  console.log('🛠️  TradeOS Interactive Prompt Manager 🛠️');
  console.log('');
  const keys = Object.keys(PROMPT_REGISTRY);

  keys.forEach((k, idx) => {
    const item = PROMPT_REGISTRY[k];
    console.log(`  [${(idx + 1).toString().padStart(2)}] ${k.padEnd(18)} : ${item.title}`);
  });

  console.log('  [ q] Quit');
  console.log('');

  const selection = (await question('Select a prompt number or ID to prepare: ')).trim();
  if (selection.toLowerCase() === 'q' || !selection) {
    rl.close();
    return;
  }

  let chosenId = null;
  const num = parseInt(selection, 10);
  if (!isNaN(num) && num >= 1 && num <= keys.length) {
    chosenId = keys[num - 1];
  } else if (PROMPT_REGISTRY[selection]) {
    chosenId = selection;
  }

  if (!chosenId) {
    console.log('❌ Invalid selection.');
    rl.close();
    return;
  }

  const item = PROMPT_REGISTRY[chosenId];
  console.log('');
  console.log(`Configuring: ${item.title}`);
  console.log(`(${item.description})`);
  console.log('');

  const userVars = {};
  for (const [vName, vCfg] of Object.entries(item.variables)) {
    const answer = await question(`- ${vName} [${vCfg.default}]: `);
    userVars[vName] = answer.trim() || vCfg.default;
  }

  const { rendered } = renderPrompt(chosenId, userVars, REPO_ROOT);

  console.log('');
  console.log('================ RENDERED PROMPT ================');
  console.log(rendered);
  console.log('==================================================');
  console.log('');

  const shouldCopy = (await question('Copy to clipboard? (Y/n): ')).trim().toLowerCase();
  if (shouldCopy !== 'n') {
    const copied = copyToClipboard(rendered);
    if (copied) {
      console.log('✅ Copied to clipboard! Ready to paste in ChatGPT or Claude Code in WebStorm.');
    } else {
      console.log('(Clipboard access unavailable; rendered above.)');
    }
  }

  rl.close();
}

async function main() {
  const args = process.argv.slice(2);
  const { positional, flags } = parseCliArgs(args);
  const command = positional[0] || 'interactive';

  switch (command) {
    case 'list':
      listPrompts();
      break;

    case 'show': {
      const id = positional[1];
      if (!id) {
        console.error('Error: missing prompt ID. Usage: prompt show <id>');
        process.exit(1);
      }
      showPrompt(id);
      break;
    }

    case 'render': {
      const id = positional[1];
      if (!id) {
        console.error('Error: missing prompt ID. Usage: prompt render <id> [--flags]');
        process.exit(1);
      }
      try {
        const { rendered } = renderPrompt(id, flags, REPO_ROOT);
        console.log(rendered);
      } catch (err) {
        console.error(`❌ ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'copy': {
      const id = positional[1];
      if (!id) {
        console.error('Error: missing prompt ID. Usage: prompt copy <id> [--flags]');
        process.exit(1);
      }
      try {
        const { rendered } = renderPrompt(id, flags, REPO_ROOT);
        const copied = copyToClipboard(rendered);
        if (copied) {
          console.log(`✅ Copied "${id}" prompt to clipboard! Ready to paste.`);
        } else {
          console.log(rendered);
          console.log('(Clipboard access unavailable; rendered above.)');
        }
      } catch (err) {
        console.error(`❌ ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'interactive':
      await runInteractive();
      break;

    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;

    default:
      if (PROMPT_REGISTRY[command]) {
        const { rendered } = renderPrompt(command, flags, REPO_ROOT);
        const copied = copyToClipboard(rendered);
        if (copied) {
          console.log(`✅ Copied "${command}" prompt to clipboard!`);
        } else {
          console.log(rendered);
        }
      } else {
        printUsage();
      }
      break;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
