import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Replicate __dirname for ES Modules, as it's not available by default.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const templatePath = path.join(__dirname, '..', 'farcaster.template.json');
const outputPath = path.join(__dirname, '..', 'public', '.well-known', 'farcaster.json');
const outputDir = path.dirname(outputPath);

try {
  console.log('Starting farcaster.json generation...');
  
  const allowedAddressesStr = process.env.VITE_ALLOWED_ADDRESSES;
  if (!allowedAddressesStr) {
    throw new Error('VITE_ALLOWED_ADDRESSES environment variable is not set.');
  }

  const allowedAddresses = allowedAddressesStr.split(',').map(addr => addr.trim());
  console.log(`Processing ${allowedAddresses.length} allowed addresses.`);

  const templateData = fs.readFileSync(templatePath, 'utf8');
  const result = templateData.replace(
    '"__VITE_ALLOWED_ADDRESSES__"', 
    JSON.stringify(allowedAddresses)
  );

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  fs.writeFileSync(outputPath, result, 'utf8');
  console.log(`Successfully generated ${outputPath}`);

} catch (err) {
  console.error('Error generating farcaster.json:', err.message);
  process.exit(1);
}
