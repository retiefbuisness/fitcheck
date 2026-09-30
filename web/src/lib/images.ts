import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type Bucket = 'closet' | 'posts' | 'avatars';

// Resizes and compresses a photo in the browser before upload.
export async function compressImage(file: Blob, maxWidth = 1080): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo"))), 'image/jpeg', 0.75),
  );
}

export async function uploadImage(bucket: Bucket, userId: string, blob: Blob) {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export async function removeImage(bucket: Bucket, path: string | null | undefined) {
  if (!path) return;
  await supabase.storage.from(bucket).remove([path]);
}

// Photos live in private buckets, so the browser gets short-lived signed URLs.
// Requests made in the same tick are batched into one call per bucket.
const cache = new Map<string, { url: string; expires: number }>();
const pending = new Map<Bucket, Map<string, ((url: string | null) => void)[]>>();
let timer: number | null = null;

function flush() {
  timer = null;
  for (const [bucket, requests] of pending) {
    pending.delete(bucket);
    const paths = [...requests.keys()];
    supabase.storage
      .from(bucket)
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        for (const p of paths) {
          const url = data?.find((d) => d.path === p)?.signedUrl ?? null;
          if (url) cache.set(`${bucket}/${p}`, { url, expires: Date.now() + 55 * 60_000 });
          requests.get(p)!.forEach((cb) => cb(url));
        }
      });
  }
}

function cached(bucket: Bucket, path: string) {
  const hit = cache.get(`${bucket}/${path}`);
  return hit && hit.expires > Date.now() ? hit.url : null;
}

function signedUrl(bucket: Bucket, path: string): Promise<string | null> {
  const hit = cached(bucket, path);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    let forBucket = pending.get(bucket);
    if (!forBucket) {
      forBucket = new Map();
      pending.set(bucket, forBucket);
    }
    forBucket.set(path, [...(forBucket.get(path) ?? []), resolve]);
    if (timer == null) timer = window.setTimeout(flush, 10);
  });
}

export function useSignedUrl(bucket: Bucket, path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() => (path ? cached(bucket, path) : null));
  useEffect(() => {
    if (!path) return;
    let alive = true;
    signedUrl(bucket, path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [bucket, path]);
  return path ? url : null;
}

// Two most common colours in the centre of a photo, as #rrggbb.
export async function dominantColors(file: Blob): Promise<string[]> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const canvas = document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 80;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0, 60, 80);
    bitmap.close();
    const { data } = ctx.getImageData(12, 16, 36, 48);
    const buckets = new Map<number, [number, number, number, number]>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
      const acc = buckets.get(key) ?? [0, 0, 0, 0];
      acc[0]++;
      acc[1] += r;
      acc[2] += g;
      acc[3] += b;
      buckets.set(key, acc);
    }
    const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
    return [...buckets.values()]
      .sort((a, b) => b[0] - a[0])
      .slice(0, 2)
      .map(([n, r, g, b]) => `#${hex(r / n)}${hex(g / n)}${hex(b / n)}`);
  } catch {
    return [];
  }
}
