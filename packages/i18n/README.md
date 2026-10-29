# @vibefork.me/i18n

The languages and the product glossary of Vibefork: one set for the site, the editor and the agent.

## Contents

- `locales.json` — the languages. `source` is the language texts are written in first and the fallback
  for missing ones. Each language has a BCP 47 `code`, a `name` in itself, a short `mark` and a `status`:
  - `ready` — fully translated in every product and offered to people;
  - `planned` — being translated; may be partial, missing texts fall back to the source; not offered.
- `glossary.json` — the form of `address` per language, `forbidden` spellings and the terms. A term with
  `match` (a JavaScript regular expression, case-insensitive unless `caseSensitive`) is checked: where
  the source text matches it, the text in each language of `expect` contains one of its variants
  (case-insensitive). A term without `match` is guidance for translators.

Both files are formatted as `JSON.stringify(data, null, 2)` with a final newline.

## Check

`npm run check` (from the repository root or this folder) verifies both files:

- language codes are unique BCP 47 tags; names and marks are given, marks are unique; the source
  language is listed and `ready`;
- `address` and every term's `say` are given for exactly the listed languages;
- `match` is a valid regular expression without control characters; `expect` names listed languages
  other than the source, and each of them says the term with one of its variants;
- term ids are unique; no `say` uses a forbidden spelling; no unknown fields;
- the formatting above.

## Use in a product

A product keeps a byte-for-byte copy of both files next to a `SOURCE.json`:

```json
{
  "repository": "vibefork-me/shared",
  "commit": "<commit of this repository the copy is taken from>",
  "files": {
    "locales.json": "<sha256 of the file, hex>",
    "glossary.json": "<sha256 of the file, hex>"
  }
}
```

The product's own check, offline:

- the sha256 of each copied file equals `SOURCE.json`;
- its languages are exactly the codes of `locales.json`;
- every `ready` language has every text; a `planned` one may be partial and is not offered;
- its texts follow the glossary; keys a product exempts from a term are listed in that product.

The copy changes only by copying from this repository again, never by hand.

## Adding a language

1. Here: the language with `status: "planned"`, its `name`, `mark`, `address` and `say` of every term,
   plus `expect` where the term is checked in it.
2. In each product: the new copy and the translations; partial ones are allowed.
3. Once every product has every text: `status: "ready"` here, and the new copy in each product.

A language is offered only when it is `ready`, so in every product at once.

## License

MIT
