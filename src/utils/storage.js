import { supabase } from './supabase';

/**
 * Upload a file to a Supabase storage bucket.
 * Returns the public URL on success.
 */
export async function uploadFile(bucket, file, folder = '') {
  if (!file) return null;

  const ext      = file.name.split('.').pop();
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const path     = folder ? `${folder}/${safeName}` : safeName;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload multiple files, return an object of { fieldName: url }.
 * fileMap = { fieldName: File | null }
 */
export async function uploadFiles(bucket, fileMap, folder = '') {
  const results = {};
  for (const [key, file] of Object.entries(fileMap)) {
    if (file) {
      results[key] = await uploadFile(bucket, file, folder);
    } else {
      results[key] = null;
    }
  }
  return results;
}
