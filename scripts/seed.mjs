import { seedInvoiceDemo } from './invoice-seed.mjs';

const { counts, persisted } = await seedInvoiceDemo();
console.log(`${persisted ? 'Loaded' : 'Validated'} deterministic invoice seed data: ${JSON.stringify(counts)}`);
if (!persisted) console.log('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to load this fixture into Supabase.');
