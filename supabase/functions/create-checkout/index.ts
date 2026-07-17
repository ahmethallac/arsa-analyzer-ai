import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new Error('Unauthorized');
    const user = userData.user;

    const { priceId, credits } = await req.json();
    if (!priceId || typeof priceId !== 'string' || !priceId.startsWith('price_')) {
      throw new Error('Invalid priceId');
    }
    if (!Number.isInteger(credits) || credits <= 0 || credits > 1000) {
      throw new Error('Invalid credits');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' });

    // Find or create customer
    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: existing } = await svc
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const list = await stripe.customers.list({ email: user.email, limit: 1 });
      if (list.data.length > 0) {
        customerId = list.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { supabase_user_id: user.id },
        });
        customerId = customer.id;
      }
    }

    const origin = req.headers.get('origin') || 'https://arsaanaliz.app';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/packages?status=success`,
      cancel_url: `${origin}/packages?status=cancelled`,
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          credits_per_period: String(credits),
        },
      },
      metadata: {
        supabase_user_id: user.id,
        credits_per_period: String(credits),
      },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('create-checkout error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
