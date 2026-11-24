import * as fs from 'node:fs';
import * as path from 'node:path';

// Reader upload files of the RDR cases (Test Data TD-06 / TD-13 "RDR_* with placeholders"), kept next to
// this file as common/testdata/RDR_*.csv so anyone can open and review them:
//   RDR_01-valid.csv                   RDR-003  two new readers (one lower-case with spaces: upper-cased + trimmed)
//   RDR_02-existing-serial.csv         RDR-004  a serial that already exists on the working company
//   RDR_03-unknown-mid.csv             RDR-004  a MID no company has
//   RDR_04-company-not-registered.csv  RDR-004  the working MID with a Service Provider it is not registered with
//   RDR_05-invalid-serial.csv          RDR-004  a serial with a space and symbols
//   RDR_06-duplicate-in-csv.csv        RDR-004  the same new serial twice in one file
//   RDR_07-not-a-csv.xlsx              RDR-004  not a CSV (fixed file, no placeholders)
//   RDR_08-reassign.csv                RDR-005  an existing test reader's serial with company B's MID
// Placeholders {LIKE_THIS} are filled per run (fresh serials / MIDs), because fixed values would be used up:
// a registered serial becomes "existing" on the next run, and a "unknown" MID can start to exist.

export type ReaderCsvFile =
  | 'RDR_01-valid.csv' | 'RDR_02-existing-serial.csv' | 'RDR_03-unknown-mid.csv' | 'RDR_04-company-not-registered.csv'
  | 'RDR_05-invalid-serial.csv' | 'RDR_06-duplicate-in-csv.csv' | 'RDR_07-not-a-csv.xlsx' | 'RDR_08-reassign.csv';

// The file's content with every {PLACEHOLDER} replaced; CRLF line endings, as the portal's template.
// An unfilled placeholder is an error (the test would upload nonsense otherwise).
export function readerCsv(file: ReaderCsvFile, values: Record<string, string> = {}): string {
  const raw = fs.readFileSync(path.join(__dirname, file), 'latin1');
  const filled = raw.replace(/\{([A-Z0-9_]+)\}/g, (match, key: string) => {
    if (!(key in values)) throw new Error(`${file}: no value for placeholder ${match}`);
    return values[key];
  });
  return file.endsWith('.csv') ? filled.replace(/\r?\n/g, '\r\n') : filled;
}
