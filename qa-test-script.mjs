import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in env.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== STEP 1: AUTHENTICATION & RLS TEST ===");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'rggaadjanur@gmail.com',
    password: '123456',
  });

  if (authError) {
    console.error("❌ Login failed:", authError.message);
    process.exit(1);
  } else {
    console.log("✅ Login successful. Session created.");
  }

  const tablesToTest = [
    'categories',
    'products',
    'expenses',
    'transactions',
    'transaction_items',
    'daily_balances',
    'profiles'
  ];

  console.log("\nTesting RLS access for authenticated user:");
  const accessResults = {};
  for (const table of tablesToTest) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`❌ Table '${table}' returned error: ${error.message}`);
      accessResults[table] = 'Error: ' + error.message;
    } else {
      console.log(`✅ Table '${table}' is accessible.`);
      accessResults[table] = 'OK';
    }
  }

  console.log("\n=== STEP 2: DATABASE MIGRATION VERIFICATION ===");
  console.log("Fetching OpenAPI spec to verify schema...");
  
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
    const spec = await res.json();
    
    const requiredTables = [
      'categories', 'products', 'expenses', 'transactions', 'transaction_items', 'profiles', 'daily_balances'
    ];
    
    for (const table of requiredTables) {
      if (spec.definitions[table]) {
        console.log(`✅ Table '${table}' exists.`);
      } else {
        console.log(`❌ Table '${table}' is MISSING in schema.`);
      }
    }

    console.log("\nChecking required columns:");
    
    const requiredColumns = {
      products: ['id', 'name', 'price', 'stock', 'barcode', 'category_id'],
      transactions: ['id', 'total', 'payment_method', 'cashier_id', 'created_at'],
      transaction_items: ['transaction_id', 'product_id', 'qty', 'price']
    };

    for (const [table, columns] of Object.entries(requiredColumns)) {
      console.log(`\nTable '${table}':`);
      if (spec.definitions[table]) {
        const tableProps = spec.definitions[table].properties;
        for (const col of columns) {
          if (tableProps[col]) {
            console.log(`  ✅ Column '${col}' exists.`);
          } else {
            console.log(`  ❌ Column '${col}' is MISSING.`);
          }
        }
      } else {
        console.log(`  ⚠️ Cannot check columns, table missing.`);
      }
    }

  } catch (err) {
    console.error("Failed to fetch OpenAPI spec:", err.message);
  }
}

main();
