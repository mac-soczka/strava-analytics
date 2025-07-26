const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');

function enableNoLimitsMode() {
  console.log('🚀 Enabling Strava No-Limits Mode...');
  
  try {
    // Check if .env.local exists
    if (!fs.existsSync(envPath)) {
      console.log('❌ .env.local file not found. Please create it first with your environment variables.');
      return;
    }
    
    // Read current .env.local
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Check if STRAVA_NO_LIMITS already exists
    if (envContent.includes('STRAVA_NO_LIMITS=')) {
      // Update existing line
      envContent = envContent.replace(
        /STRAVA_NO_LIMITS=.*/g,
        'STRAVA_NO_LIMITS=true'
      );
      console.log('✅ Updated existing STRAVA_NO_LIMITS setting');
    } else {
      // Add new line
      envContent += '\n# Strava No-Limits Mode (disable rate limiting)\nSTRAVA_NO_LIMITS=true\n';
      console.log('✅ Added STRAVA_NO_LIMITS=true to .env.local');
    }
    
    // Write back to file
    fs.writeFileSync(envPath, envContent);
    
    console.log('🎉 No-limits mode enabled!');
    console.log('⚠️  IMPORTANT: You need to restart your development server for changes to take effect.');
    console.log('   Run: yarn dev');
    
  } catch (error) {
    console.error('❌ Error enabling no-limits mode:', error.message);
  }
}

function disableNoLimitsMode() {
  console.log('⚡ Disabling Strava No-Limits Mode...');
  
  try {
    // Check if .env.local exists
    if (!fs.existsSync(envPath)) {
      console.log('❌ .env.local file not found.');
      return;
    }
    
    // Read current .env.local
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Check if STRAVA_NO_LIMITS exists
    if (envContent.includes('STRAVA_NO_LIMITS=')) {
      // Update existing line
      envContent = envContent.replace(
        /STRAVA_NO_LIMITS=.*/g,
        'STRAVA_NO_LIMITS=false'
      );
      console.log('✅ Updated STRAVA_NO_LIMITS to false');
    } else {
      console.log('ℹ️  STRAVA_NO_LIMITS setting not found in .env.local');
      return;
    }
    
    // Write back to file
    fs.writeFileSync(envPath, envContent);
    
    console.log('🎉 No-limits mode disabled!');
    console.log('⚠️  IMPORTANT: You need to restart your development server for changes to take effect.');
    console.log('   Run: yarn dev');
    
  } catch (error) {
    console.error('❌ Error disabling no-limits mode:', error.message);
  }
}

function checkNoLimitsStatus() {
  console.log('🔍 Checking No-Limits Mode Status...');
  
  try {
    // Check if .env.local exists
    if (!fs.existsSync(envPath)) {
      console.log('❌ .env.local file not found.');
      return;
    }
    
    // Read current .env.local
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Check for STRAVA_NO_LIMITS setting
    const match = envContent.match(/STRAVA_NO_LIMITS=(.+)/);
    
    if (match) {
      const value = match[1].trim();
      console.log(`📊 Current setting: STRAVA_NO_LIMITS=${value}`);
      
      if (value === 'true') {
        console.log('🚀 No-limits mode is ENABLED');
        console.log('   Rate limiting is disabled - Strava will handle limits naturally');
      } else {
        console.log('⚡ No-limits mode is DISABLED');
        console.log('   Rate limiting is enabled - app will respect Strava limits');
      }
    } else {
      console.log('ℹ️  STRAVA_NO_LIMITS setting not found in .env.local');
      console.log('   Default behavior: Rate limiting is ENABLED');
    }
    
  } catch (error) {
    console.error('❌ Error checking no-limits status:', error.message);
  }
}

// Handle command line arguments
const command = process.argv[2];

switch (command) {
  case 'enable':
  case 'on':
    enableNoLimitsMode();
    break;
  case 'disable':
  case 'off':
    disableNoLimitsMode();
    break;
  case 'status':
  case 'check':
    checkNoLimitsStatus();
    break;
  default:
    console.log('🚀 Strava No-Limits Mode Manager');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/enable-no-limits.js enable  - Enable no-limits mode');
    console.log('  node scripts/enable-no-limits.js disable - Disable no-limits mode');
    console.log('  node scripts/enable-no-limits.js status  - Check current status');
    console.log('');
    console.log('What is No-Limits Mode?');
    console.log('  - Disables internal rate limiting');
    console.log('  - Lets Strava handle rate limits naturally');
    console.log('  - Useful for testing and development');
    console.log('  - May hit Strava rate limits faster');
    console.log('');
    console.log('⚠️  Remember to restart your dev server after changing settings!');
} 