import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { inventorySnippetOwnership } from './snippet-ownership-inventory';

interface Options {
  apply: boolean;
  profile: string;
  region: string;
  pageTable?: string;
  snippetTable?: string;
  backupDir: string;
  checkpoint: string;
}

interface DynamoAttribute {
  S?: string;
  L?: DynamoAttribute[];
}

type DynamoItem = Record<string, DynamoAttribute>;

interface Checkpoint {
  pageTable: string;
  snippetTable: string;
  completedSnippetIds: string[];
}

function parseOptions(args: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument.startsWith('--') && argument !== '--apply') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`);
      values.set(argument, value);
      index += 1;
    }
  }

  return {
    apply: args.includes('--apply'),
    profile: values.get('--profile') ?? 'amplify-dev',
    region: values.get('--region') ?? 'eu-west-3',
    pageTable: values.get('--page-table'),
    snippetTable: values.get('--snippet-table'),
    backupDir: values.get('--backup-dir') ?? 'backups/snippet-ownership',
    checkpoint: values.get('--checkpoint') ?? '.snippet-ownership-checkpoint.json',
  };
}

function awsJson(options: Options, args: string[]): any {
  const output = execFileSync('aws', [
    ...args,
    '--profile', options.profile,
    '--region', options.region,
    '--output', 'json',
  ], {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
    env: { ...process.env, PYTHONUTF8: '1', AWS_CLI_AUTO_PROMPT: 'off' },
  });
  return output ? JSON.parse(output) : {};
}

function resolveTable(options: Options, explicitName: string | undefined, prefix: string): string {
  if (explicitName) return explicitName;
  const result = awsJson(options, ['dynamodb', 'list-tables']);
  const matches = (result.TableNames as string[]).filter(name => name.startsWith(`${prefix}-`));
  if (matches.length !== 1) {
    throw new Error(`Expected one ${prefix}-* table, found ${matches.length}. Pass --${prefix.toLowerCase()}-table explicitly.`);
  }
  return matches[0];
}

function scanTable(options: Options, tableName: string): DynamoItem[] {
  const items: DynamoItem[] = [];
  let exclusiveStartKey: DynamoItem | undefined;

  do {
    const args = ['dynamodb', 'scan', '--table-name', tableName];
    if (exclusiveStartKey) {
      args.push('--exclusive-start-key', JSON.stringify(exclusiveStartKey));
    }
    const result = awsJson(options, args);
    items.push(...(result.Items ?? []));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey && Object.keys(exclusiveStartKey).length > 0);

  return items;
}

function stringValue(item: DynamoItem, field: string): string | undefined {
  return item[field]?.S;
}

function stringList(item: DynamoItem, field: string): string[] {
  return item[field]?.L?.flatMap(value => value.S ? [value.S] : []) ?? [];
}

function loadCheckpoint(path: string, pageTable: string, snippetTable: string): Checkpoint {
  try {
    const checkpoint = JSON.parse(readFileSync(path, 'utf8')) as Checkpoint;
    if (checkpoint.pageTable !== pageTable || checkpoint.snippetTable !== snippetTable) {
      throw new Error(`Checkpoint ${path} belongs to different tables.`);
    }
    return checkpoint;
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error;
    return { pageTable, snippetTable, completedSnippetIds: [] };
  }
}

function saveCheckpoint(path: string, checkpoint: Checkpoint): void {
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
}

function updateOwner(options: Options, tableName: string, snippetId: string, ownerPageId: string): void {
  awsJson(options, [
    'dynamodb', 'update-item',
    '--table-name', tableName,
    '--key', JSON.stringify({ id: { S: snippetId } }),
    '--update-expression', 'SET #owner = :owner, #updatedAt = :updatedAt',
    '--condition-expression', 'attribute_exists(#id) AND (attribute_not_exists(#owner) OR #owner = :owner)',
    '--expression-attribute-names', JSON.stringify({ '#id': 'id', '#owner': 'ownerPageId', '#updatedAt': 'updatedAt' }),
    '--expression-attribute-values', JSON.stringify({
      ':owner': { S: ownerPageId },
      ':updatedAt': { S: new Date().toISOString() },
    }),
  ]);
}

function printDetails(label: string, values: unknown[]): void {
  console.log(`${label}: ${values.length}`);
  for (const value of values) console.log(`  ${JSON.stringify(value)}`);
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  const pageTable = resolveTable(options, options.pageTable, 'Page');
  const snippetTable = resolveTable(options, options.snippetTable, 'Snippet');
  const pageItems = scanTable(options, pageTable);
  const snippetItems = scanTable(options, snippetTable);

  const pages = pageItems.flatMap(item => {
    const id = stringValue(item, 'id');
    return id ? [{ id, title: stringValue(item, 'title'), snippetIds: stringList(item, 'snippet_ids') }] : [];
  });
  const snippets = snippetItems.flatMap(item => {
    const id = stringValue(item, 'id');
    return id ? [{ id, ownerPageId: stringValue(item, 'ownerPageId') }] : [];
  });
  const inventory = inventorySnippetOwnership(pages, snippets);

  console.log(`Mode: ${options.apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Page table: ${pageTable}`);
  console.log(`Snippet table: ${snippetTable}`);
  console.log(`Pages: ${pages.length}; snippets: ${snippets.length}`);
  printDetails('Assignments', inventory.assignments);
  printDetails('Already aligned', inventory.alignedSnippetIds);
  printDetails('Conflicts', inventory.conflicts);
  printDetails('Orphans', inventory.orphans);
  printDetails('Missing snippet IDs', inventory.missingSnippetReferences);
  printDetails('Duplicate page references', inventory.duplicatePageReferences);

  if (!options.apply) {
    console.log('Dry-run complete; no files or remote data were modified.');
    return;
  }

  const blockers = inventory.conflicts.length
    + inventory.missingSnippetReferences.length
    + inventory.duplicatePageReferences.length;
  if (blockers > 0) {
    throw new Error(`Migration blocked by ${blockers} ownership or reference issue(s).`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve(options.backupDir, `snippet-ownership-${timestamp}.json`);
  mkdirSync(dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, `${JSON.stringify({ pageTable, snippetTable, pageItems, snippetItems }, null, 2)}\n`, 'utf8');
  console.log(`Backup: ${backupPath}`);

  const checkpoint = loadCheckpoint(options.checkpoint, pageTable, snippetTable);
  const completed = new Set(checkpoint.completedSnippetIds);
  for (const assignment of inventory.assignments) {
    if (completed.has(assignment.snippetId)) continue;
    updateOwner(options, snippetTable, assignment.snippetId, assignment.ownerPageId);
    completed.add(assignment.snippetId);
    checkpoint.completedSnippetIds = [...completed].sort();
    saveCheckpoint(options.checkpoint, checkpoint);
    console.log(`Updated ${assignment.snippetId} -> ${assignment.ownerPageId}`);
  }
  console.log(`Migration complete: ${completed.size} assignment(s) checkpointed.`);
}

main();
