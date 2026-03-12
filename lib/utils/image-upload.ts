import { createClient } from '@/lib/supabase/client';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function uploadProductImage(
  file: File,
  productId: string
): Promise<UploadResult> {
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.',
    };
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      success: false,
      error: 'File too large. Maximum size is 2MB.',
    };
  }

  const supabase = createClient();

  // Generate unique file path
  const fileExt = file.name.split('.').pop();
  const fileName = `${productId}-${Date.now()}.${fileExt}`;
  const filePath = `products/${fileName}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: 'Failed to upload image. Please try again.',
    };
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  return {
    success: true,
    url: urlData.publicUrl,
  };
}

export async function deleteProductImage(imageUrl: string): Promise<boolean> {
  if (!imageUrl) return true;

  const supabase = createClient();

  // Extract file path from URL
  try {
    const urlParts = imageUrl.split('/storage/v1/object/public/');
    if (urlParts.length < 2) return true;

    const filePath = urlParts[1];
    const { error } = await supabase.storage
      .from('product-images')
      .remove([filePath]);

    return !error;
  } catch {
    return false;
  }
}

export function validateBarcode(barcode: string): boolean {
  // EAN-13, EAN-8, UPC-A, UPC-E, or generic numeric codes
  const validBarcode = /^\d{8,14}$/;
  return validBarcode.test(barcode);
}

export function generateSKU(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SKU-${timestamp}-${random}`;
}