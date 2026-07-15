import { seedInvoiceDemo } from './invoice-seed.mjs';

const { counts, persisted } = await seedInvoiceDemo();
console.log(`${persisted ? 'Reset and loaded' : 'Validated reset source for'} demo data: ${JSON.stringify(counts)}`);
if (!persisted) console.log('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to perform the database reset.');
