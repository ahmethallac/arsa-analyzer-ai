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

    const svc = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: sub } = await svc
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (!sub?.stripe_customer_id) throw new Error('No subscription found');

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' });
    const origin = req.headers.get('origin') || 'https://arsaanaliz.app';

    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/packages`,
    });

    return new Response(JSON.stringify({ url: portal.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('customer-portal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
