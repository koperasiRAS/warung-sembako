const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '.next', 'static');
const destDir = path.join(__dirname, 'public', '_next', 'static');

try {
  // Ensure the destination directory exists
  fs.mkdirSync(destDir, { recursive: true });
  
  // Copy all statically generated files into the public directory
  // so that Passenger / Litespeed servers can serve them properly.
  fs.cpSync(srcDir, destDir, { recursive: true });
  
  console.log('✅ Next.js static files correctly copied to public/_next/static for Hostinger Web Server routing.');
} catch (err) {
  console.error('❌ Failed to copy static files for Hostinger:', err);
  process.exit(1);
}
