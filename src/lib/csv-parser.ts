import Papa from 'papaparse';
import type { Transaction } from './types';

export function parseCSV(file: File): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const transactions = validateAndParse(results.data as Record<string, string>[]);
          resolve(transactions);
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(new Error(`CSV parsing failed: ${err.message}`)),
    });
  });
}

const REQUIRED_COLUMNS = ['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'];

function validateAndParse(rows: Record<string, string>[]): Transaction[] {
  if (rows.length === 0) throw new Error('CSV file is empty');

  const headers = Object.keys(rows[0]);
  const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(', ')}. Required: ${REQUIRED_COLUMNS.join(', ')}`);
  }

  const transactions: Transaction[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2; // +2 for 1-indexed + header row

    if (!row.transaction_id?.trim()) {
      errors.push(`Row ${lineNum}: missing transaction_id`);
      continue;
    }
    if (!row.sender_id?.trim()) {
      errors.push(`Row ${lineNum}: missing sender_id`);
      continue;
    }
    if (!row.receiver_id?.trim()) {
      errors.push(`Row ${lineNum}: missing receiver_id`);
      continue;
    }

    const amount = parseFloat(row.amount);
    if (isNaN(amount) || amount <= 0) {
      errors.push(`Row ${lineNum}: invalid amount "${row.amount}"`);
      continue;
    }

    const timestamp = new Date(row.timestamp);
    if (isNaN(timestamp.getTime())) {
      errors.push(`Row ${lineNum}: invalid timestamp "${row.timestamp}"`);
      continue;
    }

    transactions.push({
      transaction_id: row.transaction_id.trim(),
      sender_id: row.sender_id.trim(),
      receiver_id: row.receiver_id.trim(),
      amount,
      timestamp,
    });
  }

  if (errors.length > 0 && transactions.length === 0) {
    throw new Error(`All rows invalid. First errors:\n${errors.slice(0, 5).join('\n')}`);
  }

  if (errors.length > 0) {
    console.warn(`${errors.length} rows skipped due to validation errors`);
  }

  return transactions;
}
