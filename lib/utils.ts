import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ALLOWED_IMAGE_PROTOCOLS = ['https:'];
const ALLOWED_IMAGE_HOSTS = [
  '.supabase.co',
  'images.unsplash.com',
  'img.clerk.com',
  'www.google.com',
];

export function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!ALLOWED_IMAGE_PROTOCOLS.includes(parsed.protocol)) return null;
    const hostAllowed = ALLOWED_IMAGE_HOSTS.some((h) =>
      parsed.hostname.endsWith(h) || parsed.hostname === h.slice(1)
    );
    return hostAllowed ? url : null;
  } catch {
    return null;
  }
}
