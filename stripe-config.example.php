<?php
/**
 * stripe-config.example.php — TEMPLATE ONLY.
 *
 * The real stripe-config.php lives on the production server (e.g. Hostinger
 * public_html/ one level above this api/ directory) and is NEVER committed
 * to git. .gitignore excludes the real filename.
 *
 * Copy this file to stripe-config.php and paste your live secret key:
 *
 *   $ cp stripe-config.example.php ../stripe-config.php
 *
 * Then edit ../stripe-config.php and replace the placeholder.
 */

return [
  // Get this from https://dashboard.stripe.com → Developers → API keys.
  // Use the LIVE key in production. Test mode keys start with sk_test_.
  'secret' => 'sk_live_REPLACE_ME_WITH_YOUR_STRIPE_SECRET_KEY',

  // Optional: webhook signing secret for /api/webhook.php (v1.1).
  // Get from Stripe Dashboard → Developers → Webhooks → your endpoint.
  // 'webhook_secret' => 'whsec_REPLACE_ME',
];
