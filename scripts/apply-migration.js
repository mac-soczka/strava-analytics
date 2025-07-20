#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Configuration
const config = {
  local: {
    url: 'http://localhost:54321',
    serviceRoleKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  },
  production: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  }
};

// Read migration file
function readMigrationFile() {
  const migrationPath = path.join(__dirname, '../supabase/migrations/20241201000000_initial_schema.sql');
  if (!fs.existsSync(migrationPath)) {
    throw new Error('Migration file not found: ' + migrationPath);
  }
  return fs.readFileSync(migrationPath, 'utf8');
}

// Apply migration to a database
async function applyMigration(environment, dbConfig) {
  console.log(`\n🚀 Applying migration to ${environment} database...`);
  
  if (!dbConfig.url || !dbConfig.serviceRoleKey) {
    console.error(`❌ Missing configuration for ${environment}`);
    console.error(`   URL: ${dbConfig.url ? 'SET' : 'MISSING'}`);
    console.error(`   Service Role Key: ${dbConfig.serviceRoleKey ? 'SET' : 'MISSING'}`);
    return false;
  }

  try {
    const supabase = createClient(dbConfig.url, dbConfig.serviceRoleKey);
    const migrationSQL = readMigrationFile();
    
    console.log(`📝 Executing migration SQL...`);
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`   Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error(`   ❌ Error: ${error.message}`);
          return false;
        }
      }
    }
    
    console.log(`✅ Migration applied successfully to ${environment}!`);
    return true;
    
  } catch (error) {
    console.error(`❌ Failed to apply migration to ${environment}:`, error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🗄️  Supabase Migration Tool');
  console.log('==========================');
  
  const args = process.argv.slice(2);
  const target = args[0] || 'both'; // 'local', 'production', or 'both'
  
  console.log(`\n📋 Target: ${target}`);
  console.log(`📁 Migration: 20241201000000_initial_schema.sql`);
  
  let success = true;
  
  if (target === 'local' || target === 'both') {
    const localSuccess = await applyMigration('LOCAL', config.local);
    success = success && localSuccess;
  }
  
  if (target === 'production' || target === 'both') {
    const prodSuccess = await applyMigration('PRODUCTION', config.production);
    success = success && prodSuccess;
  }
  
  if (success) {
    console.log('\n🎉 All migrations completed successfully!');
    console.log('\n📊 What was created:');
    console.log('   • users table (with RLS policies)');
    console.log('   • strava_tokens table (with RLS policies)');
    console.log('   • activities table (with RLS policies)');
    console.log('   • Indexes for performance');
    console.log('   • Triggers for updated_at timestamps');
    console.log('   • UUID extension enabled');
  } else {
    console.log('\n❌ Some migrations failed. Check the errors above.');
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { applyMigration, readMigrationFile }; 