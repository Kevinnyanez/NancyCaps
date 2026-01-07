export async function exportToExcel(filename: string, rows: Array<Record<string, any>>) {
  if (typeof window === 'undefined') {
    throw new Error('exportToExcel can only be used in the browser');
  }

  try {
    const XLSX = await import('xlsx');
    const fsaver = await import('file-saver');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    // file-saver exports saveAs
    (fsaver as any).saveAs(blob, filename);
  } catch (err) {
    console.error('Error exporting to Excel', err);
    throw err;
  }
}
