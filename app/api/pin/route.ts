import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// ─── Rate Limiting (in-memory, per IP) ─────────────────────────────────────
const attemptsPerIP = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attemptsPerIP.get(ip);

  if (!entry || now > entry.resetAt) {
    attemptsPerIP.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// ─── Timing-safe PIN comparison ──────────────────────────────────────────────
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

function hashPin(pin: string): string {
  // Simple SHA-256 hash — stored as pin_hash in profiles table
  // Use Node.js built-in crypto
  const { createHash } = require('crypto');
  return createHash('sha256').update(pin).digest('hex');
}

export async function POST(request: Request) {
  // ── Rate Limit Check ──────────────────────────────────────────────────────
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' },
      { status: 429 }
    );
  }

  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN diperlukan' }, { status: 400 });
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN harus 6 digit angka' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Konfigurasi server tidak lengkap. Hubungi administrator.' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Fetch all profiles that have a pin_hash set
    const { data: kasirs, error: kasirError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, pin_hash')
      .not('pin_hash', 'is', null);

    if (kasirError) {
      return NextResponse.json({ error: 'Gagal mengambil data kasir' }, { status: 500 });
    }

    if (!kasirs || kasirs.length === 0) {
      return NextResponse.json({ error: 'PIN salah' }, { status: 401 });
    }

    // ── Try RPC first (server-side hashed comparison) ──────────────────────
    let matchedKasir = null;

    try {
      const { data: rpcResult } = await supabaseAdmin.rpc('verify_pin', {
        pin_input: pin,
      });

      if (rpcResult && Array.isArray(rpcResult) && rpcResult.length > 0) {
        // RPC exists and returned a match
        const ownerProfile = rpcResult.find((p: any) => p.role === 'owner');
        matchedKasir = ownerProfile || rpcResult[0];
      }
    } catch {
      // RPC not available — fall through to fallback
    }

    // ── Fallback: direct hash comparison (no RPC needed) ───────────────────
    if (!matchedKasir) {
      const pinHash = hashPin(pin);
      for (const kasir of kasirs) {
        if (kasir.pin_hash && timingSafeCompare(pinHash, kasir.pin_hash)) {
          matchedKasir = kasir;
          break;
        }
      }
    }

    if (!matchedKasir) {
      return NextResponse.json({ error: 'PIN salah' }, { status: 401 });
    }

    // Deterministic password per user ID — no need to update on every login
    const deterministicPassword = `${matchedKasir.id}-POS-Auth!1`;

    const { cookies } = await import('next/headers');
    const { createServerClient } = await import('@supabase/ssr');

    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    // Try login with existing deterministic password
    let { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: matchedKasir.email,
      password: deterministicPassword,
    });

    // If password not set yet, set it once
    if (sessionError || !sessionData.session) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        matchedKasir.id,
        { password: deterministicPassword }
      );

      if (updateError) {
        return NextResponse.json(
          { error: 'Gagal menyiapkan sesi autentikasi' },
          { status: 500 }
        );
      }

      const retryAuth = await supabase.auth.signInWithPassword({
        email: matchedKasir.email,
        password: deterministicPassword,
      });
      sessionData = retryAuth.data;
      sessionError = retryAuth.error;
    }

    if (sessionError || !sessionData.session) {
      return NextResponse.json({ error: 'Gagal membuat sesi' }, { status: 500 });
    }

    return NextResponse.json({
      user: {
        id: matchedKasir.id,
        email: matchedKasir.email,
        full_name: matchedKasir.full_name,
        role: matchedKasir.role,
      },
      session: sessionData.session,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}