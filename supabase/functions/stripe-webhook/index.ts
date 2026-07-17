import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' });

const svc = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function findProfileId(userId: string): Promise<string | null> {
  const { data } = await svc
    .from('profiles')
    .select('id')
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();
  return data?.id ?? null;
}

async function grantCredits(userId: string, credits: number, invoiceId: string, description: string) {
  const purchaseToken = `stripe_invoice:${invoiceId}`;

  const { data: existing } = await svc
    .from('credit_transactions')
    .select('id')
    .eq('purchase_token', purchaseToken)
    .maybeSingle();

  if (existing) {
    console.log(`Invoice ${invoiceId} already credited, skipping`);
    return;
  }

  let profileId = await findProfileId(userId);
  if (!profileId) {
    // Create a profile if missing
    const { data: newProfile } = await svc
      .from('profiles')
      .insert({ id: userId, user_id: userId, credits: 0 })
      .select('id')
      .single();
    profileId = newProfile?.id ?? userId;
  }

  await svc.from('credit_transactions').insert({
    user_id: profileId,
    amount: credits,
    type: 'purchase',
    description,
    purchase_token: purchaseToken,
  });

  await svc.rpc('recalculate_profile_credits', { p_profile_id: profileId });
  console.log(`Granted ${credits} credits to ${userId} for invoice ${invoiceId}`);
}

async function upsertSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) {
    console.warn('Subscription missing supabase_user_id metadata:', sub.id);
    return;
  }
  const creditsPerPeriod = parseInt(sub.metadata?.credits_per_period || '0', 10);
  const priceId = sub.items.data[0]?.price.id ?? null;
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  await svc.from('subscriptions').upsert(
    {
      user_id: userId,
      stripe_customer_id: sub.customer as string,
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      status: sub.status,
      credits_per_period: creditsPerPeriod,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          // Ensure metadata is on subscription itself
          if (!sub.metadata?.supabase_user_id && session.metadata?.supabase_user_id) {
            await stripe.subscriptions.update(sub.id, {
              metadata: {
                supabase_user_id: session.metadata.supabase_user_id,
                credits_per_period: session.metadata.credits_per_period ?? '0',
              },
            });
            sub.metadata = {
              supabase_user_id: session.metadata.supabase_user_id,
              credits_per_period: session.metadata.credits_per_period ?? '0',
            } as Stripe.Metadata;
          }
          await upsertSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscription(sub);
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = sub.metadata?.supabase_user_id;
        const credits = parseInt(sub.metadata?.credits_per_period || '0', 10);

        if (userId && credits > 0) {
          const description = `Aylık abonelik kredisi (${credits} kredi)`;
          await grantCredits(userId, credits, invoice.id, description);
        }
        await upsertSubscription(sub);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
