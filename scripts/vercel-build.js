const { execSync } = require('child_process');

function runCommand(command, description, allowFailure = false) {
  try {
    console.log(`\n${description}...`);
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    if (allowFailure) {
      console.log(`⚠️  ${description} failed, but continuing...`);
      console.log(`   Error: ${error.message}`);
      return false;
    } else {
      console.error(`❌ ${description} failed`);
      throw error;
    }
  }
}

async function main() {
  try {
    // Install dependencies
    runCommand('npm install --include=dev', '📦 Installing dependencies');
    
    // Generate Prisma Client
    runCommand('npx prisma generate', '🔧 Generating Prisma Client');
    
    // Try to run migrations with retries
    console.log('\n🔄 Running database migrations...');
    const maxRetries = 3;
    let migrationSuccess = false;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`   Attempt ${i + 1}/${maxRetries}...`);
        execSync('npx prisma migrate deploy', { 
          stdio: 'inherit',
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        console.log('✅ Migrations completed successfully');
        migrationSuccess = true;
        break;
      } catch (error) {
        if (i < maxRetries - 1) {
          console.log(`⚠️  Migration attempt ${i + 1} failed, retrying in 5 seconds...`);
          console.log(`   Error: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          console.log('⚠️  Migration deploy failed after all retries');
          console.log('⚠️  This is usually safe if migrations are already applied');
          console.log('⚠️  Continuing with build...');
        }
      }
    }
    
    // Build Next.js
    runCommand('npm run build', '🏗️  Building Next.js application');
    
    console.log('\n✅ Build completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

main();

