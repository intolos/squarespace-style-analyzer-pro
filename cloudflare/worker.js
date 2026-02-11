// worker.js - Multi-product license worker (module worker)
// Supports multiple extensions with separate licenses via product_id
// All extension-specific values come from request body or environment variables

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, '');

    // simple health-check
    if (request.method === 'GET' && (pathname === '' || pathname === '/')) {
      return new Response(
        'Multi-Product License Worker Active - v4.4.6.3 (Flexible Billing Support)',
        {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }
      );
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
  // CRITICAL FIX 2026-02-11: Bumped to v3 to invalidate all stale/buggy cache records
  // that may contain fabricated "Today + 1 Year" expiration dates or missing dates from v1/v2.
  return `v3:${productId}:email:${email}`;
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
  // IMPORTANT: Client sends extension_type and purchase_type directly so webhook can
  // stamp Customer metadata without needing Product ID environment variables. Fixed 2026-01-23.
  if (body.extension_type) {
    params.append('metadata[extension_type]', body.extension_type);
  }
  if (body.purchase_type) {
    params.append('metadata[purchase_type]', body.purchase_type);
  }

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
    // IMPORTANT: Lifetime licenses return null for expires_at.
    // This allows the frontend to definitively identify it as "Lifetime" styling.
    expires = null;
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

  // Extract custom fields (Names)
  let firstName = '';
  let lastName = '';
  let businessName = '';
  if (session.custom_fields && Array.isArray(session.custom_fields)) {
    session.custom_fields.forEach(f => {
      if (f.key === 'first_name') firstName = f.text ? f.text.value : '';
      if (f.key === 'last_name') lastName = f.text ? f.text.value : '';
      if (f.key === 'business_name') businessName = f.text ? f.text.value : '';
    });
  }

  const record = {
    email,
    product_id: resolvedProductId,
    // IMPORTANT: Include is_lifetime and is_yearly flags so frontend can correctly
    // display "Premium Activated - Lifetime" vs "Premium Activated - Yearly".
    // Bug fixed 2026-01-23: these were missing, causing button to show wrong text.
    is_lifetime: isLifetime,
    is_yearly: !isLifetime,
    first_name: firstName,
    last_name: lastName,
    business_name: businessName,
    active: true,
    created_at: session.created,
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
  const purchaseType = (url.searchParams.get('purchase_type') || '').toLowerCase(); // 'lifetime' or 'yearly'
  const debugMode = url.searchParams.get('debug') === 'true';
  console.log(
    'handleCheckEmail called for:',
    email,
    'product:',
    productId,
    'purchase_type:',
    purchaseType,
    'debug:',
    debugMode
  );

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

  addLog(`Starting validation for ${email} (Product: ${productId}, Type: ${purchaseType})`);

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
      // PRIORITY 1: CUSTOMER METADATA (The Golden Ticket)
      // IMPORTANT: Check is_lifetime FIRST. If true, STOP immediately.
      // Only check is_yearly if is_lifetime is false.
      // This ensures users who upgrade from yearly to lifetime always see "Lifetime" status.
      // Fixed 2026-01-23.
      addLog('PRIORITY 1: Checking Customer Metadata...');
      for (const customer of customers) {
        if (debugMode)
          addLog(`Checking customer ${customer.id} metadata: ${JSON.stringify(customer.metadata)}`);

        // Check is_lifetime FIRST
        if (customer.metadata && String(customer.metadata.is_lifetime).toLowerCase() === 'true') {
          // STRICT TYPE CHECK: Only match if we are looking for lifetime
          if (purchaseType === 'yearly') {
            addLog(`Skipping Lifetime metadata match because purchase_type is 'yearly'`);
            continue;
          }

          console.log('Valid Lifetime Validation: Customer Metadata');
          addLog('SUCCESS: Found is_lifetime=true in customer metadata.');
          const record = createRecord(
            email,
            productId,
            customer.id,
            'lifetime_metadata',
            now,
            null,
            null,
            null,
            customer.created
          );
          await cacheRecord(env, record);
          return jsonResponse({ valid: true, record });
        }

        // CRITICAL FIX 2026-02-11: Removed Yearly Metadata check here.
        // We MUST NOT validate yearly subscriptions via metadata alone because metadata
        // does not contain the expiration date. Relying on metadata causes the system
        // to fabricate a "Now + 365 days" expiration, which is wrong for existing subscriptions.
        // By removing this, we force the logic to fall through to Priority 4 (Stripe Subscriptions),
        // which fetches the REAL current_period_end from the active subscription.
      }

      // PRIORITY 2: LIFETIME SESSIONS
      // Check ALL customers for valid lifetime sessions
      // SKIP if purchaseType is 'yearly'
      if (purchaseType !== 'yearly') {
        addLog('PRIORITY 2: Checking Lifetime Sessions...');
        for (const customer of customers) {
          addLog(`Fetching sessions for customer ${customer.id}...`);
          const sessionsResp = await fetch(
            `https://api.stripe.com/v1/checkout/sessions?customer=${encodeURIComponent(
              customer.id
            )}&limit=100`,
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

            return (
              isComplete && isPaid && isPaymentMode && (isLifetimeMeta || isZero) && isAppGroup
            );
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
              validSession.id,
              null,
              null,
              validSession.created
            );
            await cacheRecord(env, record);
            return jsonResponse({ valid: true, record });
          }
        }
      } else {
        addLog('PRIORITY 2: Skipping Lifetime Sessions (purchase_type=yearly)');
      }

      // PRIORITY 3: CHARGES (Lifetime Fallback)
      // SKIP if purchaseType is 'yearly'
      if (purchaseType !== 'yearly') {
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
            const record = createRecord(
              email,
              productId,
              customer.id,
              'lifetime_charge',
              now,
              null,
              null,
              null,
              validCharge.created
            );
            await cacheRecord(env, record);
            return jsonResponse({ valid: true, record });
          }
        }
      } else {
        addLog('PRIORITY 3: Skipping Lifetime Charges (purchase_type=yearly)');
      }

      // PRIORITY 4: YEARLY SUBSCRIPTIONS
      // Only check this if no lifetime found AND purchaseType is not explicitly 'lifetime'
      if (purchaseType !== 'lifetime') {
        addLog('PRIORITY 4: Checking Subscriptions...');
        for (const customer of customers) {
          addLog(`Fetching subscriptions for customer ${customer.id}...`);
          const subsResp = await fetch(
            `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(
              customer.id
            )}&status=active`,
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
            // CRITICAL FIX 2026-02-11: Robust date retrieval for Flexible Billing & Metadata-heavy subs
            // We check these fields in order of reliability:
            let expires = validSub.current_period_end || validSub.cancel_at || validSub.trial_end;

            // If still missing, attempt a detail fetch (List API can be sparse)
            if (!expires) {
              addLog(`- Date missing from list. Performing detail fetch for ${validSub.id}...`);
              const subDetailResp = await fetch(
                `https://api.stripe.com/v1/subscriptions/${validSub.id}`,
                { method: 'GET', headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` } }
              );
              const subDetail = await subDetailResp.json();
              if (subDetail && !subDetail.error) {
                expires =
                  subDetail.current_period_end || subDetail.cancel_at || subDetail.trial_end;
                // Last ditch fallback: if it's usage-based/flexible and has no period end yet,
                // use the billing anchor + 1 year as a placeholder (better than failing).
                if (!expires && subDetail.billing_cycle_anchor) {
                  addLog('- No period end found in detail. Falling back to anchor + 1yr.');
                  expires = subDetail.billing_cycle_anchor + 365 * 24 * 60 * 60;
                }
              }
            }

            if (debugMode) {
              addLog(`- Sub Detail: id=${validSub.id}, status=${validSub.status}`);
              addLog(
                `- Fields: period_end=${validSub.current_period_end}, cancel_at=${validSub.cancel_at}, trial_end=${validSub.trial_end}, anchor=${validSub.billing_cycle_anchor}`
              );
              addLog(`- effectively selected expires: ${expires}`);
              if (!expires) {
                addLog(`- FULL SUB JSON: ${JSON.stringify(validSub)}`);
              }
            }

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
              expires,
              validSub.created
            );
            await cacheRecord(env, record);
            return jsonResponse({ valid: true, record });
          }
        }
      } else {
        addLog('PRIORITY 4: Skipping Yearly Subscriptions (purchase_type=lifetime)');
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
      // CRITICAL FIX 2026-02-11: Harden cache validation
      // 1. Handle future last_checked timestamps (legacy bug remnants)
      // 2. Ignore yearly records missing an expiration date
      const timeDiffHours = Math.abs(now - record.last_checked) / 3600;
      const isTimeValid = timeDiffHours < 24;
      const isExpirationSafe = !record.is_yearly || (record.is_yearly && record.expires_at);

      if (isTimeValid && isExpirationSafe) {
        const valid = record.active === true || (record.expires_at && record.expires_at > now);
        console.log('Using KV cache fallback, valid:', valid);
        addLog(`KV Fallback decision: Valid=${valid}`);
        return jsonResponse({ valid, record });
      } else {
        addLog(
          `KV Record rejected: isTimeValid=${isTimeValid} (diff: ${timeDiffHours}h), isExpirationSafe=${isExpirationSafe}`
        );
      }
    }
  } else {
    addLog('No KV Record found.');
  }

  addLog('FINAL RESULT: Validation Failed.');
  return jsonResponse({ valid: false });
}

// Helpers for cleaner code
function createRecord(email, pid, cusId, type, now, sessId, subId, expires, originalCreatedAt) {
  // For lifetime types (metadata, session, charge), we want expires_at to be NULL/undefined
  // This ensures the frontend identifies it as "Lifetime" instead of "Yearly"
  const isLife = type.includes('lifetime');

  let exp = expires;
  if (!expires && !isLife) {
    // CRITICAL FIX 2026-02-11: REMOVED dangerous fallback that set now + 365 days.
    // If we don't have an expiration date for a non-lifetime license, we MUST NOT
    // fabricate one. Use undefined/null and let validation logic handle it (or fail).
    console.error(
      `CRITICAL: No expiration date found for ${type} (non-lifetime) - email: ${email}`
    );
    // Extra debug info for KV
    const debugPid = pid;
    console.log(`Debug Record PID: ${debugPid}, Email: ${email}`);
  }
  // If isLife is true, exp remains undefined/null (perfect for UI logic)

  // IMPORTANT: Add is_lifetime and is_yearly flags to the returned record.
  // The client checks these flags directly instead of comparing Product IDs.
  // Fixed 2026-01-23 to restore variable-based architecture.
  // IMPORTANT: Use originalCreatedAt from Stripe data when available to preserve
  // subscription start dates across product IDs (cross-product access).
  // Fixed 2026-02-11 to ensure consistent dates across all Style Analyzer Pro extensions.
  // CRITICAL: Do NOT fall back to 'now' if originalCreatedAt is missing - this would
  // create fake subscription dates for expired subscriptions. Log error instead.
  if (!originalCreatedAt) {
    console.error(
      `CRITICAL: Missing originalCreatedAt for ${type} - email: ${email}, cusId: ${cusId}`
    );
  }

  return {
    email,
    product_id: pid,
    is_lifetime: isLife,
    is_yearly: !isLife,
    active: true,
    created_at: originalCreatedAt,
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

    // Extract names from custom fields (LIFETIME FIX)
    let firstName = '';
    let lastName = '';
    let businessName = '';
    if (session.custom_fields && Array.isArray(session.custom_fields)) {
      session.custom_fields.forEach(f => {
        if (f.key === 'first_name') firstName = f.text ? f.text.value : '';
        if (f.key === 'last_name') lastName = f.text ? f.text.value : '';
        if (f.key === 'business_name') businessName = f.text ? f.text.value : '';
      });
    }
    const fullName = `${firstName} ${lastName}`.trim();

    // IMPORTANT: Auto-stamp Customer metadata for both Lifetime and Yearly purchases.
    // This ensures Priority 1 checking works instantly and provides marketing analytics.
    // Fixed 2026-01-23 to restore variable-based architecture.
    const isLifetime = session.metadata && session.metadata.is_lifetime === 'true';
    const isYearly = !isLifetime;

    if (session.customer) {
      try {
        console.log(
          `Stamping Customer ${session.customer}: Lifetime=${isLifetime}, Yearly=${isYearly}, Product=${productId}`
        );

        // Fetch existing customer metadata to check if this is first purchase
        const customerResp = await fetch(
          `https://api.stripe.com/v1/customers/${session.customer}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` },
          }
        );
        const customer = await customerResp.json();
        const existingMeta = customer.metadata || {};

        const updateParams = new URLSearchParams();

        // Current status flags (can change over time)
        updateParams.append('metadata[is_lifetime]', isLifetime ? 'true' : 'false');
        updateParams.append('metadata[is_yearly]', isYearly ? 'true' : 'false');
        updateParams.append('metadata[app_group]', 'style_analyzer');

        // Marketing metadata - ONLY stamp on first purchase (never reset)
        if (!existingMeta.original_purchase_extension) {
          // IMPORTANT: Read extension_type and purchase_type directly from session metadata
          // (sent by client) instead of comparing Product IDs. This removes the need for
          // Product ID environment variables. Fixed 2026-01-23.
          const extensionType = session.metadata?.extension_type || 'unknown';
          const purchaseType =
            session.metadata?.purchase_type || (isLifetime ? 'lifetime' : 'yearly');

          updateParams.append('metadata[original_purchase_extension]', extensionType);
          updateParams.append('metadata[original_purchase_type]', purchaseType);
        }

        // Cross-product access flags (buy one extension, get access to both)
        updateParams.append('metadata[access_squarespace]', 'true');
        updateParams.append('metadata[access_website]', 'true');

        // Customer name and business name
        if (fullName) updateParams.append('name', fullName);
        if (businessName) updateParams.append('metadata[business_name]', businessName);

        await fetch(`https://api.stripe.com/v1/customers/${session.customer}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.STRIPE_SECRET}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: updateParams.toString(),
        });
        console.log('Customer metadata stamped successfully.');
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
        // IMPORTANT: Lifetime licenses return null for expires_at.
        // This allows the frontend to definitively identify it as "Lifetime" styling.
        expires = null;
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
        first_name: firstName,
        last_name: lastName,
        business_name: businessName,
        active: true,
        created_at: session.created,
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

      // IMPORTANT: Reset is_yearly flag in Customer metadata when subscription expires.
      // This ensures the Priority 1 check correctly identifies expired subscriptions.
      // Fixed 2026-01-23.
      const customerId = obj.customer;
      if (customerId && event.type !== 'customer.subscription.updated') {
        try {
          console.log(`Resetting is_yearly for customer ${customerId} via webhook ${event.type}`);
          const updateParams = new URLSearchParams();
          updateParams.append('metadata[is_yearly]', 'false');

          await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.STRIPE_SECRET}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: updateParams.toString(),
          });
        } catch (err) {
          console.error('Failed to reset customer metadata via webhook:', err);
        }
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
