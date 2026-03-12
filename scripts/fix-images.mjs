import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://veguomydgmyinlzjabdl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZ3VvbXlkZ215aW5semphYmRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIxNzE5NCwiZXhwIjoyMDg4NzkzMTk0fQ.XHxqWRC8_jyHBFoV-vPXQNPaSrhGLGeTcSZoKoEgis4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanBrokenImages() {
  console.log('Fetching products...');
  const { data: products, error } = await supabase.from('products').select('id, image_url');
  
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }
  
  const brokenProducts = products.filter(p => p.image_url && p.image_url.startsWith('blob:'));
  console.log(`Found ${brokenProducts.length} products with broken blob: URLs.`);
  
  for (const product of brokenProducts) {
    const { error: updateError } = await supabase
      .from('products')
      .update({ image_url: null })
      .eq('id', product.id);
      
    if (updateError) {
      console.error(`Failed to fix product ${product.id}:`, updateError);
    } else {
      console.log(`Successfully fixed (nulled image) for product ${product.id}`);
    }
  }
  
  console.log('Cleanup complete!');
}

cleanBrokenImages();
