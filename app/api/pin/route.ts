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

    const { data: matchResult, error: rpcError } = await supabaseAdmin.rpc('verify_pin', {
      pin_input: pin,
    });

    let matchedKasir = null;
    
    if (!rpcError && matchResult && matchResult.length > 0) {
      // Prioritaskan akun owner jika ada beberapa profil dengan PIN yang sama
      const ownerProfile = matchResult.find((p: any) => p.role === 'owner');
      matchedKasir = ownerProfile || matchResult[0];
    } else if (rpcError || (!matchResult && kasirs.length > 0)) {
      // Fallback: compare secara paralel jika RPC belum ada/error
      const kasirDetails = await Promise.all(
        kasirs.map((k) => 
          supabaseAdmin.from('profiles').select('id, email, full_name, role, pin_hash').eq('id', k.id).single()
        )
      );

      const matchPromises = kasirDetails.map(async ({ data }) => {
        if (!data?.pin_hash) return null;
        const { data: cryptResult } = await supabaseAdmin.rpc('verify_pin_plain', {
          plain: pin,
          hash: data.pin_hash,
        });
        return cryptResult === true ? data : null;
      });

      const results = await Promise.all(matchPromises);
      matchedKasir = results.find(r => r !== null);
    }

    if (!matchedKasir) {
      return NextResponse.json({ error: 'PIN salah' }, { status: 401 });
    }

    // Gunakan password deterministik untuk menghindari update password di setiap login (yang sangat lambat)
    // Cukup gunakan ID profil ditambah kombinasi unik agar aman
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

    // Coba langsung login (tanpa update)
    let { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: matchedKasir.email,
      password: deterministicPassword,
    });

    // Jika gagal login, berarti password deterministik belum di-set. Lakukan update 1x saja.
    if (sessionError || !sessionData.session) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        matchedKasir.id,
        { password: deterministicPassword }
      );

      if (updateError) {
        return NextResponse.json({ error: 'Gagal menyiapkan sesi autentikasi' }, { status: 500 });
      }

      // Coba login lagi setelah update
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