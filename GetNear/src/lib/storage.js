import { supabase } from './supabase';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Upload an image to a public Supabase Storage bucket and return its public URL.
 * @param {'restaurant-assets' | 'product-images'} bucket
 * @param {File} file
 * @param {string} [folder]
 */
export async function uploadImage(bucket, file, folder = 'uploads') {
  if (!file) return null;

  if (!ALLOWED.has(file.type)) {
    throw new Error('Use a JPG, PNG, WEBP, or GIF image');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Image must be under 5 MB');
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${folder}/${crypto.randomUUID()}.${ext || 'jpg'}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
