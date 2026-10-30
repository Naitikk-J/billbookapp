import { Customer } from '../models/Customer';
import { Company } from '../models/Company';
import { Flight } from '../models/Flight';
import { Invoice } from '../models/Invoice';
import { LedgerEntry } from '../models/LedgerEntry';
import { Product } from '../models/Product';
import { User } from '../models/User';

let indexesEnsured = false;

export async function ensureDbIndexes(): Promise<void> {
  if (indexesEnsured) return;
  await Promise.all([
    User.syncIndexes(),
    Company.syncIndexes(),
    Customer.syncIndexes(),
    Product.syncIndexes(),
    Invoice.syncIndexes(),
    LedgerEntry.syncIndexes(),
    Flight.syncIndexes(),
  ]);
  indexesEnsured = true;
}
