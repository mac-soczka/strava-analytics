#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ueboygvhxgeqlbqwlgyz.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  console.error('');
  console.error('To run this script, use:');
  console.error('SUPABASE_SERVICE_ROLE_KEY=your_service_key node scripts/apply-migration-simple.js');
  console.error('');
  console.error('You can find your service role key in:');
  console.error('Supabase Dashboard > Settings > API > service_role key');
  process.exit(1);
}

async function applyMigration() {
  console.log('🔗 Connecting to Supabase...');
  console.log('URL:', supabaseUrl);
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Read the migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20250720000000_recreate_schema.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📄 Applying migration: 20250720000000_recreate_schema.sql');
  console.log('SQL Preview:');
  console.log(migrationSQL.substring(0, 300) + '...');

  try {
    // Split SQL into individual statements for better error handling
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`\n🔧 Executing ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`   [${i + 1}/${statements.length}] Executing: ${statement.substring(0, 50)}...`);
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.error(`   ❌ Error in statement ${i + 1}:`, error.message);
          // Continue with other statements
        } else {
          console.log(`   ✅ Statement ${i + 1} completed`);
        }
      }
    }

    console.log('\n✅ Migration completed!');
    
    // Verify tables were created
    console.log('\n🔍 Verifying tables...');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['users', 'strava_tokens', 'activities']);

    if (tablesError) {
      console.error('❌ Error checking tables:', tablesError);
    } else {
      console.log('📋 Tables found:', tables.map(t => t.table_name));
      
      if (tables.length === 3) {
        console.log('🎉 All tables created successfully!');
      } else {
        console.log('⚠️  Some tables may be missing. Check the errors above.');
      }
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

applyMigration(); 