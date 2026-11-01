export const textOf = (value, lang = 'mn') => typeof value === 'string' ? value : value?.[lang] || value?.mn || value?.en || '';
export const matchSearch = (query, values) => {
  const haystack = values.map((value) => typeof value === 'object' ? Object.values(value || {}).join(' ') : value).join(' ').normalize('NFKC').toLocaleLowerCase();
  return query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/).every((word) => haystack.includes(word));
};
export function csvText(rows) {
  const cell = (value) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n');
}
export function downloadCsv(name, rows) {
  const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
