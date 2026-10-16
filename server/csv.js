'use strict';

function esc(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(rows, headers) {
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
  return lines.join('\n') + '\n';
}

// Very small CSV line parser for whitelist uploads: one smartcard per line,
// optional header row "smartcard" is skipped.
function parseLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => l.toLowerCase() !== 'smartcard');
}

module.exports = { toCsv, parseLines };
