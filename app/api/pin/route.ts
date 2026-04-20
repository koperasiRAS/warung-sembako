import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN diperlukan' }, { status: 400 });
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN harus 6 digit angka' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Cari kasir atau admin yang punya pin_hash
    const { data: kasirs, error: kasirError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role')
      .not('pin_hash', 'is', null);

    if (kasirError) {
      return NextResponse.json({ error: 'Gagal mengambil data kasir' }, { status: 500 });
    }

    if (!kasirs || kasirs.length === 0) {
      return NextResponse.json({ error: 'PIN salah' }, { status: 401 });
    }

    // Bandingkan PIN dengan pin_hash menggunakan pgcrypto
    const { data: matchResult } = await supabaseAdmin.rpc('verify_pin', {
      pin_input: pin,
    });

    // Fallback: compare satu-per-satu jika RPC belum ada
    let matchedKasir = null;
    if (matchResult === null) {
      for (const kasir of kasirs) {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('id, email, full_name, role, pin_hash')
          .eq('id', kasir.id)
          .single();

        if (!data?.pin_hash) continue;

        // crypt(plain, hash) → kalau match, hasilnya = hash
        const { data: cryptResult } = await supabaseAdmin.rpc('verify_pin_plain', {
          plain: pin,
          hash: data.pin_hash,
        });

        if (cryptResult === true) {
          matchedKasir = data;
          break;
        }
      }
    } else {
      matchedKasir = matchResult;
    }

    if (!matchedKasir) {
      return NextResponse.json({ error: 'PIN salah' }, { status: 401 });
    }

    // Generate a secure random password for the session
    const tempPassword = crypto.randomUUID() + 'A1!a';

    // Update user's password in GoTrue
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      matchedKasir.id,
      { password: tempPassword }
    );

    if (updateError) {
      return NextResponse.json({ error: 'Gagal menyiapkan sesi autentikasi' }, { status: 500 });
    }

    // Now sign in the user to create a session and set cookies
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

    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: matchedKasir.email,
      password: tempPassword,
    });

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