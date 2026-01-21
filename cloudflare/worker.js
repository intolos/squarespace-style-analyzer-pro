// worker.js - Multi-product license worker (module worker)
// Supports multiple extensions with separate licenses via product_id
// All extension-specific values come from request body or environment variables

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, '');

    // simple health-check
    if (request.method === 'GET' && (pathname === '' || pathname === '/')) {
      return new Response('Multi-Product License Worker Active', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    try {
      if (request.method === 'POST' && pathname === '/create-checkout-session') {
        return await handleCreateCheckout(request, env);
      }
      if (request.method === 'POST' && pathname === '/redeem-session') {
        return await handleRedeemSession(request, env);
      }
      if (request.method === 'GET' && pathname === '/check-email') {
        return await handleCheckEmail(request, env);
      }
      if (request.method === 'GET' && pathname === '/verify') {
        return await handleVerify(request, env);
      }
      if (request.method === 'POST' && pathname === '/webhook') {
        return await handleWebhook(request, env);
      }

      return new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || String(err) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

// Helper to build license key with product_id
function getLicenseKey(productId, email) {
  return `${productId}:email:${email}`;
}

// Helpers ------------------------------------------------------------------
async function handleCreateCheckout(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').toLowerCase();

  // Extension-specific configuration - all values come from request body or environment variables
  // Set these environment variables in Cloudflare Workers for each extension:
  // - DEFAULT_PRODUCT_ID: Default product ID for the extension
  // - SUCCESS_URL_YEARLY: Success page URL for yearly subscriptions
  // - SUCCESS_URL_LIFETIME: Success page URL for lifetime purchases
  // - CANCEL_URL: Cancel page URL
  // - STRIPE_PRICE_ID: Default Stripe price ID (optional, can be overridden in request)

  const productId = body.product_id || env.DEFAULT_PRODUCT_ID;
  const successUrlYearly = body.success_url_yearly || env.SUCCESS_URL_YEARLY;
  const successUrlLifetime = body.success_url_lifetime || env.SUCCESS_URL_LIFETIME;
  const cancelUrl = body.cancel_url || env.CANCEL_URL;
  const priceId = body.priceId || env.STRIPE_PRICE_ID;
  const mode = body.mode || 'subscription';

  // Determine which success URL to use based on mode
  const success_url = mode === 'payment' ? successUrlLifetime : successUrlYearly;

  // Validate required URLs
  if (!successUrlYearly && mode !== 'payment') {
    return new Response(
      JSON.stringify({ error: 'SUCCESS_URL_YEARLY or success_url_yearly required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!successUrlLifetime && mode === 'payment') {
    return new Response(
      JSON.stringify({
        error: 'SUCCESS_URL_LIFETIME or success_url_lifetime required for payment mode',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!cancelUrl) {
    return new Response(JSON.stringify({ error: 'CANCEL_URL or cancel_url required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.STRIPE_SECRET)
    return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

  const params = new URLSearchParams();
  params.append('mode', mode);
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  if (email) params.append('customer_email', email);
  params.append('success_url', success_url);
  params.append('cancel_url', cancelUrl);

  // Store product_id, mode, and app_group in metadata for webhook/redeem to use
  params.append('metadata[product_id]', productId);
  params.append('metadata[is_lifetime]', mode === 'payment' ? 'true' : 'false');
  // Add App Group to safely group SQS and Generic versions together
  // This allows future logic to strictly validate cross-product access
  params.append('metadata[app_group]', 'style_analyzer');

  // Only add subscription_data for subscription mode
  if (mode === 'subscription') {
    params.append('subscription_data[metadata][product_id]', productId);
    params.append('subscription_data[metadata][app_group]', 'style_analyzer');
    params.append('subscription_data[payment_behavior]', 'allow_incomplete');
    // payment_method_collection only works with recurring prices
    params.append('payment_method_collection', 'always');
  } else if (mode === 'payment') {
    // IMPORTANT: Ensure customer record is always created for lifetime payments
    // This prevents guest checkouts and ensures we can track the customer later
    params.append('customer_creation', 'always');
  }

  // Enable promotion codes
  params.append('allow_promotion_codes', 'true');

  // Add custom field for first name (FIRST)
  params.append('custom_fields[0][key]', 'first_name');
  params.append('custom_fields[0][label][type]', 'custom');
  params.append('custom_fields[0][label][custom]', 'First Name *');
  params.append('custom_fields[0][type]', 'text');
  params.append('custom_fields[0][optional]', 'false');

  // Add custom field for last name (SECOND)
  params.append('custom_fields[1][key]', 'last_name');
  params.append('custom_fields[1][label][type]', 'custom');
  params.append('custom_fields[1][label][custom]', 'Last Name *');
  params.append('custom_fields[1][type]', 'text');
  params.append('custom_fields[1][optional]', 'false');

  // Add custom field for business name (THIRD)
  params.append('custom_fields[2][key]', 'business_name');
  params.append('custom_fields[2][label][type]', 'custom');
  params.append('custom_fields[2][label][custom]', 'Business Name (Optional)');
  params.append('custom_fields[2][type]', 'text');
  params.append('custom_fields[2][optional]', 'true');

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const data = await resp.json();
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}

async function handleRedeemSession(request, env) {
  const body = await request.json().catch(() => ({}));
  const session_id = body.session_id;
  const productId = body.product_id || env.DEFAULT_PRODUCT_ID;
  if (!session_id)
    return new Response(JSON.stringify({ error: 'session_id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

  // fetch session from Stripe
  const resp = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(session_id)}?expand[]=subscription`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` },
    }
  );
  const session = await resp.json();
  const email =
    session.customer_details && session.customer_details.email
      ? session.customer_details.email.toLowerCase()
      : null;
  if (!email)
    return new Response(JSON.stringify({ error: 'no email in session' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

  // Get product_id from session metadata if available, otherwise use provided or default
  const resolvedProductId = (session.metadata && session.metadata.product_id) || productId;

  const now = Math.floor(Date.now() / 1000);
  const customerId = session.customer || null;

  // Check if this is a lifetime purchase
  const isLifetime = session.metadata && session.metadata.is_lifetime === 'true';

  // Get actual expiration date
  let expires;
  if (isLifetime) {
    // Lifetime = 100 years
    expires = now + 100 * 365 * 24 * 60 * 60;
  } else if (
    session.subscription &&
    typeof session.subscription === 'object' &&
    session.subscription.current_period_end
  ) {
    expires = session.subscription.current_period_end;
  } else if (session.subscription && typeof session.subscription === 'string') {
    // If subscription is just an ID, fetch it
    try {
      const subResp = await fetch(
        `https://api.stripe.com/v1/subscriptions/${session.subscription}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` },
        }
      );
      const sub = await subResp.json();
      if (sub.current_period_end) {
        expires = sub.current_period_end;
      }
    } catch (e) {
      console.error('Failed to fetch subscription:', e);
    }
  }

  const record = {
    email,
    product_id: resolvedProductId,
    active: true,
    created_at: now,
    expires_at: expires,
    session_id,
    stripe_customer_id: customerId,
    stripe_session: session,
  };
  const licenseKey = getLicenseKey(resolvedProductId, email);
  await env.LICENSES.put(licenseKey, JSON.stringify(record));
  return new Response(
    JSON.stringify({ ok: true, email, product_id: resolvedProductId, expires_at: expires, record }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

// Check Email Endpoint
async function handleCheckEmail(request, env) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').toLowerCase();
  const productId = url.searchParams.get('product_id') || env.DEFAULT_PRODUCT_ID;
  const debugMode = url.searchParams.get('debug') === 'true';
  console.log('handleCheckEmail called for:', email, 'product:', productId, 'debug:', debugMode);

  // Debug Logging Helper
  const debugLogs = [];
  const addLog = msg => {
    if (debugMode) debugLogs.push(msg);
    // console.log(msg); // Optional: keep server logs clean unless needed, or mirror them. User asked for minimal impact.
    if (debugMode) console.log('[DEBUG]', msg);
  };

  // Response Helper
  const jsonResponse = data => {
    if (debugMode) {
      data.debug_log = debugLogs;
    }
    return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
  };

  if (!email) return jsonResponse({ valid: false, error: 'No email provided' });

  addLog(`Starting validation for ${email} (Product: ${productId})`);

  const now = Math.floor(Date.now() / 1000);

  try {
    // 1. Fetch Customers (Handle duplicates)
    // Fetch up to 10 to handle stale/duplicate records (e.g. serial checking/guest checkouts)
    addLog('Fetching Stripe customers (limit=10)...');
    const customersResp = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=10`,
      { method: 'GET', headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` } }
    );
    const customersData = await customersResp.json();
    const customers = customersData.data || [];
    addLog(`Found ${customers.length} customer records.`);

    if (customers.length > 0) {
      // PRIORITY 1: MANUAL OVERRIDE (Customer Metadata)
      // Check ALL customers for this flag before anything else
      addLog('PRIORITY 1: Checking Customer Metadata...');
      for (const customer of customers) {
        if (debugMode)
          addLog(`Checking customer ${customer.id} metadata: ${JSON.stringify(customer.metadata)}`);

        if (customer.metadata && String(customer.metadata.is_lifetime).toLowerCase() === 'true') {
          console.log('Valid Lifetime Validation: Customer Metadata Override');
          addLog('SUCCESS: Found is_lifetime=true in customer metadata.');
          const record = createRecord(email, productId, customer.id, 'lifetime_metadata', now);
          await cacheRecord(env, record);
          return jsonResponse({ valid: true, record });
        }
      }

      // PRIORITY 2: LIFETIME SESSIONS
      // Check ALL customers for valid lifetime sessions
      addLog('PRIORITY 2: Checking Lifetime Sessions...');
      for (const customer of customers) {
        addLog(`Fetching sessions for customer ${customer.id}...`);
        const sessionsResp = await fetch(
          `https://api.stripe.com/v1/checkout/sessions?customer=${encodeURIComponent(customer.id)}&limit=100`,
          { method: 'GET', headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` } }
        );
        const sessions = (await sessionsResp.json()).data || [];
        addLog(`Found ${sessions.length} sessions.`);

        // Find any session that is 'complete' (works for $0) + (is_lifetime OR amount_total === 0)
        const validSession = sessions.find(s => {
          const isComplete = s.status === 'complete';
          const isPaid = ['paid', 'no_payment_required'].includes(s.payment_status);
          const isPaymentMode = s.mode === 'payment';
          const isLifetimeMeta = s.metadata && s.metadata.is_lifetime === 'true';
          const isZero = s.amount_total === 0;
          const isAppGroup =
            !s.metadata || !s.metadata.app_group || s.metadata.app_group === 'style_analyzer';

          if (debugMode) {
            addLog(
              `- Session ${s.id}: status=${s.status}, payment_status=${s.payment_status}, mode=${s.mode}, amount=${s.amount_total}, is_lifetime=${isLifetimeMeta}, app_group=${s.metadata?.app_group}`
            );
          }

          return isComplete && isPaid && isPaymentMode && (isLifetimeMeta || isZero) && isAppGroup;
        });

        if (validSession) {
          console.log('Valid Lifetime Validation: Checkout Session');
          addLog(`SUCCESS: Found valid lifetime session ${validSession.id}`);
          const record = createRecord(
            email,
            productId,
            customer.id,
            'lifetime_session',
            now,
            validSession.id
          );
          await cacheRecord(env, record);
          return jsonResponse({ valid: true, record });
        }
      }

      // PRIORITY 3: CHARGES (Lifetime Fallback)
      addLog('PRIORITY 3: Checking Charges...');
      for (const customer of customers) {
        addLog(`Fetching charges for customer ${customer.id}...`);
        const chargesResp = await fetch(
          `https://api.stripe.com/v1/charges?customer=${encodeURIComponent(customer.id)}&limit=100`,
          { method: 'GET', headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` } }
        );
        const charges = (await chargesResp.json()).data || [];
        addLog(`Found ${charges.length} charges.`);

        const validCharge = charges.find(c => {
          const isSucceeded = c.status === 'succeeded';
          const isLifetime = c.metadata && c.metadata.is_lifetime === 'true';
          const isAppGroup =
            !c.metadata || !c.metadata.app_group || c.metadata.app_group === 'style_analyzer';

          if (debugMode && isLifetime) {
            addLog(`- Charge ${c.id}: status=${c.status}, is_lifetime=${isLifetime}`);
          }
          return isSucceeded && isLifetime && isAppGroup;
        });

        if (validCharge) {
          console.log('Valid Lifetime Validation: Charge');
          addLog(`SUCCESS: Found valid lifetime charge ${validCharge.id}`);
          const record = createRecord(email, productId, customer.id, 'lifetime_charge', now);
          await cacheRecord(env, record);
          return jsonResponse({ valid: true, record });
        }
      }

      // PRIORITY 4: YEARLY SUBSCRIPTIONS
      // Only check this if no lifetime found
      addLog('PRIORITY 4: Checking Subscriptions...');
      for (const customer of customers) {
        addLog(`Fetching subscriptions for customer ${customer.id}...`);
        const subsResp = await fetch(
          `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customer.id)}&status=active`,
          { method: 'GET', headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` } }
        );
        const subs = (await subsResp.json()).data || [];
        addLog(`Found ${subs.length} active subscriptions.`);

        const validSub = subs.find(sub => {
          const matches = !sub.metadata.app_group || sub.metadata.app_group === 'style_analyzer';
          if (debugMode)
            addLog(`- Sub ${sub.id}: status=${sub.status}, app_group=${sub.metadata.app_group}`);
          return matches;
        });

        if (validSub) {
          let expires = validSub.current_period_end;
          // deep check for items if needed, but current_period_end is usually sufficient on sub object
          console.log('Valid Yearly Validation: Active Subscription');
          addLog(`SUCCESS: Found valid active subscription ${validSub.id}`);
          const record = createRecord(
            email,
            productId,
            customer.id,
            'yearly_sub',
            now,
            null,
            validSub.id,
            expires
          );
          await cacheRecord(env, record);
          return jsonResponse({ valid: true, record });
        }
      }
    } else {
      addLog('No customers found with this email.');
    }
  } catch (error) {
    console.error('Stripe check error:', error);
    addLog(`ERROR: ${error.message || String(error)}`);
  }

  // Fallback to KV Logic (unchanged)
  addLog('Unsuccessful so far. Checking KV Cache...');
  const licenseKey = getLicenseKey(productId, email);
  const rec = await env.LICENSES.get(licenseKey);
  if (rec) {
    const record = JSON.parse(rec);
    addLog(`KV Record Found: ${JSON.stringify(record)}`);
    if (record.stripe_customer_id && record.last_checked) {
      if ((now - record.last_checked) / 3600 < 24) {
        const valid = record.active === true || (record.expires_at && record.expires_at > now);
        console.log('Using KV cache fallback, valid:', valid);
        addLog(`KV Fallback decision: Valid=${valid}`);
        return jsonResponse({ valid, record });
      } else {
        addLog('KV Record Expired (older than 24h).');
      }
    }
  } else {
    addLog('No KV Record found.');
  }

  addLog('FINAL RESULT: Validation Failed.');
  return jsonResponse({ valid: false });
}

// Helpers for cleaner code
function createRecord(email, pid, cusId, type, now, sessId, subId, expires) {
  // For lifetime types (metadata, session, charge), we want expires_at to be NULL/undefined
  // This ensures the frontend identifies it as "Lifetime" instead of "Yearly"
  const isLife = type.includes('lifetime');

  let exp = expires;
  if (!expires && !isLife) {
    // Default fallback for non-lifetime if missing
    exp = now + 365 * 24 * 3600;
  }
  // If isLife is true, exp remains undefined/null (perfect for UI logic)

  return {
    email,
    product_id: pid,
    active: true,
    created_at: now,
    expires_at: exp,
    last_checked: now,
    stripe_customer_id: cusId,
    stripe_session_id: sessId,
    stripe_subscription_id: subId,
  };
}
async function cacheRecord(env, record) {
  const key = getLicenseKey(record.product_id, record.email);
  await env.LICENSES.put(key, JSON.stringify(record));
}
function jsonResponse(data) {
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
}

async function handleVerify(request, env) {
  // verify token (placeholder - not used by default flow)
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleWebhook(request, env) {
  const sig = request.headers.get('stripe-signature');
  const raw = await request.arrayBuffer();
  const text = new TextDecoder().decode(raw);
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response('no webhook secret', { status: 500 });

  // verify signature (simple v1 check)
  const parsed = parseStripeSigHeader(sig);
  if (!parsed) return new Response('invalid signature header', { status: 400 });
  const signed = `${parsed.t}.${text}`;
  const expected = await computeHmacHex(env.STRIPE_WEBHOOK_SECRET, signed);
  if (!constantTimeCompare(expected, parsed.v1))
    return new Response('invalid signature', { status: 400 });

  const event = JSON.parse(text);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email =
      session.customer_details && session.customer_details.email
        ? session.customer_details.email.toLowerCase()
        : null;
    const productId = (session.metadata && session.metadata.product_id) || env.DEFAULT_PRODUCT_ID;

    // LIFETIME AUTO-STAMP LOGIC
    // If this is a lifetime purchase, stamp the Customer object immediately.
    // This ensures "Priority 1" checking works instantly for this user forever.
    const isLifetime = session.metadata && session.metadata.is_lifetime === 'true';
    if (isLifetime && session.customer) {
      try {
        console.log(`Stamping Customer ${session.customer} with is_lifetime=true`);
        const updateParams = new URLSearchParams();
        updateParams.append('metadata[is_lifetime]', 'true');

        await fetch(`https://api.stripe.com/v1/customers/${session.customer}`, {
          method: 'POST', // Update customer
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: updateParams.toString(),
        });
        console.log('Customer stamped successfully.');
      } catch (err) {
        console.error('Failed to stamp customer metadata:', err);
      }
    }

    if (email) {
      const now = Math.floor(Date.now() / 1000);
      const customerId = session.customer || null;

      // Get actual subscription expiration
      let expires = now + 365 * 24 * 60 * 60; // fallback
      if (isLifetime) {
        // Lifetime = 100 years
        expires = now + 100 * 365 * 24 * 60 * 60;
      } else if (session.subscription) {
        try {
          const subResp = await fetch(
            `https://api.stripe.com/v1/subscriptions/${session.subscription}`,
            {
              method: 'GET',
              headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` },
            }
          );
          const sub = await subResp.json();
          if (sub.current_period_end) {
            expires = sub.current_period_end;
          }
        } catch (e) {
          console.error('Failed to fetch subscription in webhook:', e);
        }
      }

      const record = {
        email,
        product_id: productId,
        active: true,
        created_at: now,
        expires_at: expires,
        session_id: session.id,
        stripe_customer_id: customerId,
        stripe_event: event,
      };
      const licenseKey = getLicenseKey(productId, email);
      await env.LICENSES.put(licenseKey, JSON.stringify(record));
    }
  }

  if (
    event.type === 'invoice.payment_failed' ||
    event.type === 'customer.subscription.deleted' ||
    event.type === 'customer.subscription.updated'
  ) {
    // attempt to mark user inactive
    const obj = event.data.object || {};
    let email = obj.customer_email || '';
    if (!email && obj.customer) {
      try {
        const c = await (
          await fetch('https://api.stripe.com/v1/customers/' + encodeURIComponent(obj.customer), {
            headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` },
          })
        ).json();
        email = c.email || '';
      } catch (e) {
        email = '';
      }
    }
    email = (email || '').toLowerCase();

    // Get product_id from subscription metadata
    const productId = (obj.metadata && obj.metadata.product_id) || env.DEFAULT_PRODUCT_ID;

    if (email) {
      const licenseKey = getLicenseKey(productId, email);
      const rec = await env.LICENSES.get(licenseKey);
      if (rec) {
        const r = JSON.parse(rec);
        r.active = false;
        await env.LICENSES.put(licenseKey, JSON.stringify(r));
      }
    }
  }

  return new Response('ok');
}

// Utility functions
function parseStripeSigHeader(header) {
  if (!header) return null;
  const parts = header.split(',').map(p => p.split('='));
  const obj = {};
  for (const [k, v] of parts) obj[k] = v;
  return { t: obj.t, v1: obj.v1 };
}

async function computeHmacHex(secret, msg) {
  const enc = new TextEncoder();
  const key = enc.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(msg));
  const arr = new Uint8Array(sig);
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeCompare(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}
