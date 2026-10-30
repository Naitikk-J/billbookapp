import { Customer } from '../models/Customer';
import { Company } from '../models/Company';
import { Flight } from '../models/Flight';
import { Invoice } from '../models/Invoice';
import { LedgerEntry } from '../models/LedgerEntry';
import { Product } from '../models/Product';
import { User } from '../models/User';

let indexesEnsured = false;
let indexesRunning = false;

async function syncModelIndexes(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[db] syncIndexes failed for ${name}`, err);
  }
}

/** Best-effort index sync — never blocks or crashes the API. */
export function scheduleDbIndexes(): void {
  if (indexesEnsured || indexesRunning) return;
  if (process.env.SYNC_INDEXES_ON_START === 'false') {
    indexesEnsured = true;
    return;
  }

  indexesRunning = true;
  void (async () => {
    try {
      await Promise.all([
        syncModelIndexes('User', () => User.syncIndexes()),
        syncModelIndexes('Company', () => Company.syncIndexes()),
        syncModelIndexes('Customer', () => Customer.syncIndexes()),
        syncModelIndexes('Product', () => Product.syncIndexes()),
        syncModelIndexes('Invoice', () => Invoice.syncIndexes()),
        syncModelIndexes('LedgerEntry', () => LedgerEntry.syncIndexes()),
        syncModelIndexes('Flight', () => Flight.syncIndexes()),
      ]);
    } finally {
      indexesEnsured = true;
      indexesRunning = false;
    }
  })();
}
