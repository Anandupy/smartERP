/* eslint-disable */
/**
 * Audits the generated OpenAPI document for response-contract coverage.
 *
 * Reports every operation whose success `data` is undocumented and every
 * operation missing the standard failure responses, so a gap shows up as a
 * line of output rather than as a client discovering it at runtime.
 *
 * Usage: node scripts/audit-openapi.js <openapi.json> [--verbose]
 */
const fs = require('fs');

const doc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const verbose = process.argv.includes('--verbose');

const REQUIRED_ERRORS = ['400', '401', '403', '500'];
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

/** True when `data` is documented as something more than "an object". */
function describesPayload(schema) {
  if (!schema) return false;
  if (schema.$ref) return true;
  if (schema.type === 'array') return describesPayload(schema.items);
  if (schema.nullable === true && schema.example === null) return true; // explicit null
  if (schema.properties && Object.keys(schema.properties).length > 0)
    return true;
  if (schema.additionalProperties) return true;
  if (['string', 'number', 'integer', 'boolean'].includes(schema.type))
    return true;
  return false;
}

const rows = [];

for (const [path, item] of Object.entries(doc.paths ?? {})) {
  for (const method of METHODS) {
    const operation = item[method];
    if (!operation) continue;

    const responses = operation.responses ?? {};
    const successCodes = Object.keys(responses).filter((code) =>
      code.startsWith('2'),
    );

    const success = successCodes[0];
    const schema =
      success && responses[success].content?.['application/json']?.schema;

    const enveloped = !!schema?.properties?.success;
    const dataSchema = schema?.properties?.data;
    const documented = describesPayload(dataSchema);
    const missingErrors = REQUIRED_ERRORS.filter((code) => !responses[code]);

    rows.push({
      route: `${method.toUpperCase()} ${path}`,
      tag: (operation.tags ?? ['-'])[0],
      success: success ?? 'NONE',
      enveloped,
      documented,
      missingErrors,
    });
  }
}

const undocumented = rows.filter((r) => !r.documented);
const unenveloped = rows.filter((r) => !r.enveloped);
const missingErrors = rows.filter((r) => r.missingErrors.length > 0);

if (verbose) {
  for (const row of rows) {
    console.log(
      `${row.documented ? 'ok  ' : 'GAP '} ${row.success} ${row.route}`,
    );
  }
  console.log('');
}

if (undocumented.length) {
  console.log('Operations whose data payload is not documented:');
  for (const row of undocumented) {
    console.log(`  [${row.tag}] ${row.route} (${row.success})`);
  }
  console.log('');
}

if (unenveloped.length) {
  console.log('Operations whose success response is not the envelope:');
  for (const row of unenveloped) {
    console.log(`  [${row.tag}] ${row.route} (${row.success})`);
  }
  console.log('');
}

if (missingErrors.length) {
  console.log('Operations missing standard failure responses:');
  for (const row of missingErrors) {
    console.log(
      `  [${row.tag}] ${row.route} — missing ${row.missingErrors.join(', ')}`,
    );
  }
  console.log('');
}

console.log(
  `${rows.length} operations | ${rows.length - undocumented.length} with a documented payload | ` +
    `${rows.length - unenveloped.length} enveloped | ${rows.length - missingErrors.length} with full error coverage`,
);
