// Check of the shared language list and glossary (`npm run check`).
//
// - Both files are written as `JSON.stringify(data, null, 2)` plus a newline, so a copy in a product
//   has the same bytes and the same sha256.
// - locales.json: the codes are unique BCP 47 tags; every language has a name, a unique mark and the
//   status `ready` or `planned`; the source language is in the list and ready.
// - glossary.json: the form of address and every term's `say` are given for exactly the listed
//   languages; a checked term (with `match`) has a valid regular expression without control characters
//   and `expect` for one or more languages other than the source (the languages it is checked in), and
//   each of those languages' `say` contains one of its `expect`; term ids are unique; no `say` uses a
//   forbidden spelling; no unknown fields.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function read(file) {
  const text = readFileSync(join(root, file), "utf8");
  const data = JSON.parse(text);
  if (text !== JSON.stringify(data, null, 2) + "\n") {
    errors.push(`${file}: not formatted as JSON.stringify(data, null, 2) with a final newline`);
  }
  return data;
}

function onlyFields(where, obj, allowed) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) errors.push(`${where}: unknown field "${key}"`);
  }
}

const isText = (v) => typeof v === "string" && v.trim() !== "";

// language[-script][-region]: en, pt-BR, es-419, sr-Latn-RS.
const BCP47 = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?$/;
const STATUSES = ["ready", "planned"];

const locales = read("locales.json");
onlyFields("locales.json", locales, ["about", "source", "locales"]);
const codes = [];
const marks = new Set();
for (const [i, locale] of (locales.locales ?? []).entries()) {
  const where = `locales.json: locales[${i}]`;
  onlyFields(where, locale, ["code", "name", "mark", "status"]);
  if (!BCP47.test(locale.code ?? "")) errors.push(`${where}: "${locale.code}" is not a BCP 47 tag`);
  if (codes.includes(locale.code)) errors.push(`${where}: "${locale.code}" is listed twice`);
  codes.push(locale.code);
  if (!isText(locale.name)) errors.push(`${where}: no name`);
  if (!isText(locale.mark)) errors.push(`${where}: no mark`);
  else if (marks.has(locale.mark)) errors.push(`${where}: mark "${locale.mark}" is used twice`);
  marks.add(locale.mark);
  if (!STATUSES.includes(locale.status)) errors.push(`${where}: status must be one of ${STATUSES.join(", ")}`);
}
const source = locales.locales?.find((l) => l.code === locales.source);
if (!source) errors.push(`locales.json: source "${locales.source}" is not in the list`);
else if (source.status !== "ready") errors.push(`locales.json: source "${locales.source}" must be ready`);
const others = codes.filter((c) => c !== locales.source);

/** `obj` has a value for exactly the languages in `expected`. */
function perLanguage(where, obj, expected, valid, what) {
  if (!obj || typeof obj !== "object") return void errors.push(`${where}: missing`);
  for (const code of expected) {
    if (!(code in obj)) errors.push(`${where}: no ${what} for ${code}`);
    else if (!valid(obj[code])) errors.push(`${where}.${code}: not a valid ${what}`);
  }
  for (const code of Object.keys(obj)) {
    if (!expected.includes(code)) errors.push(`${where}: ${code} is not in locales.json`);
  }
}

const glossary = read("glossary.json");
onlyFields("glossary.json", glossary, ["about", "address", "forbidden", "terms"]);
perLanguage("glossary.json: address", glossary.address, codes, isText, "form of address");
const forbidden = glossary.forbidden ?? [];
if (!Array.isArray(forbidden) || !forbidden.every(isText)) errors.push("glossary.json: forbidden must be a list of texts");

const ids = new Set();
for (const [i, term] of (glossary.terms ?? []).entries()) {
  const where = `glossary.json: term "${term.id ?? i}"`;
  onlyFields(where, term, ["id", "note", "match", "caseSensitive", "say", "expect"]);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(term.id ?? "")) errors.push(`${where}: id must be lowercase words joined by "-"`);
  if (ids.has(term.id)) errors.push(`${where}: id is used twice`);
  ids.add(term.id);
  if (!isText(term.note)) errors.push(`${where}: no note`);
  perLanguage(`${where}: say`, term.say, codes, isText, "text");
  for (const [code, text] of Object.entries(term.say ?? {})) {
    for (const spelling of forbidden) {
      if (String(text).includes(spelling)) errors.push(`${where}: say.${code} uses the forbidden "${spelling}"`);
    }
  }

  if (term.match === undefined) {
    if (term.expect !== undefined || term.caseSensitive !== undefined) {
      errors.push(`${where}: expect and caseSensitive need a match`);
    }
    continue;
  }
  if (!isText(term.match) || /[\u0000-\u001f]/.test(term.match)) {
    errors.push(`${where}: match must be a text without control characters (write \\\\b in JSON, not \\b)`);
  } else {
    try {
      new RegExp(term.match, term.caseSensitive ? "u" : "iu");
    } catch (e) {
      errors.push(`${where}: match is not a valid regular expression: ${e.message}`);
    }
  }
  if (term.caseSensitive !== undefined && typeof term.caseSensitive !== "boolean") {
    errors.push(`${where}: caseSensitive must be true or false`);
  }
  const isVariants = (v) => Array.isArray(v) && v.length > 0 && v.every(isText);
  if (!term.expect || typeof term.expect !== "object" || Object.keys(term.expect).length === 0) {
    errors.push(`${where}: a checked term needs expect for at least one language`);
  }
  for (const [code, variants] of Object.entries(term.expect ?? {})) {
    if (!others.includes(code)) errors.push(`${where}: expect.${code}: not a listed language other than the source`);
    else if (!isVariants(variants)) errors.push(`${where}: expect.${code}: not a valid list of texts`);
  }
  for (const code of Object.keys(term.expect ?? {})) {
    const say = term.say?.[code];
    const variants = term.expect?.[code];
    if (isText(say) && isVariants(variants) && !variants.some((v) => say.toLowerCase().includes(v.toLowerCase()))) {
      errors.push(`${where}: say.${code} "${say}" contains none of expect.${code}`);
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`check-i18n: ${errors.length} problem(s)`);
  process.exit(1);
}
const ready = locales.locales.filter((l) => l.status === "ready").length;
console.log(`check-i18n: ${codes.length} languages (${ready} ready), ${ids.size} terms`);
