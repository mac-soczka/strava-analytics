#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function applyAuthMigration() {
  console.log('🔧 Applying authentication migration...');

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables');
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Create app_sessions table
    console.log('📋 Creating app_sessions table...');
    
    const { error: createTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS app_sessions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          strava_id BIGINT NOT NULL REFERENCES users(strava_id) ON DELETE CASCADE,
          session_token TEXT UNIQUE NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (createTableError) {
      console.error('❌ Error creating app_sessions table:', createTableError);
      throw createTableError;
    }

    // Create indexes
    console.log('🔍 Creating indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_app_sessions_token ON app_sessions(session_token);',
      'CREATE INDEX IF NOT EXISTS idx_app_sessions_strava_id ON app_sessions(strava_id);',
      'CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);'
    ];

    for (const indexSql of indexes) {
      const { error: indexError } = await supabase.rpc('exec_sql', { sql: indexSql });
      if (indexError) {
        console.error('❌ Error creating index:', indexError);
        throw indexError;
      }
    }

    // Enable RLS
    console.log('🔒 Enabling Row Level Security...');
    
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;'
    });

    if (rlsError) {
      console.error('❌ Error enabling RLS:', rlsError);
      throw rlsError;
    }

    // Create RLS policies
    console.log('📜 Creating RLS policies...');
    
    const { error: policyError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE POLICY "Sessions can be managed by service role" ON app_sessions
          FOR ALL USING (true);
      `
    });

    if (policyError) {
      console.error('❌ Error creating RLS policy:', policyError);
      throw policyError;
    }

    // Create cleanup function
    console.log('🧹 Creating cleanup function...');
    
    const { error: functionError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
        RETURNS void AS $$
        BEGIN
          DELETE FROM app_sessions WHERE expires_at < NOW();
        END;
        $$ LANGUAGE plpgsql;
      `
    });

    if (functionError) {
      console.error('❌ Error creating cleanup function:', functionError);
      throw functionError;
    }

    console.log('✅ Authentication migration completed successfully!');
    console.log('');
    console.log('📝 What was added:');
    console.log('  - app_sessions table for session management');
    console.log('  - Indexes for performance optimization');
    console.log('  - Row Level Security policies');
    console.log('  - Session cleanup function');
    console.log('');
    console.log('🚀 You can now test the new authentication system at /test');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
applyAuthMigration(); 