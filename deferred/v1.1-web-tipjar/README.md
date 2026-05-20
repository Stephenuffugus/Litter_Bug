# Deferred: web tip-jar (v1.1)

These two files are a Stripe Checkout integration for an external "buy the
dev a coffee" page. They are NOT part of the v1 game build.

Reasons they live here, not at repo root:

1. **Platform fit.** Steam takes payment at the storefront. iOS and Android
   require IAP for any digital entitlement and forbid third-party payment
   for digital goods. A Stripe endpoint is only useful for a separate web
   marketing or tip-jar site, never inside the game.
2. **Litter Bug v1 has no in-app payment surface.** Until and unless we
   ship a companion website for the game, this code does nothing.
3. **It has real security issues that need fixing before any production
   use.** Wildcard CORS, `HTTP_HOST` trusted into success/cancel URLs
   (open redirect), no idempotency key on Stripe POSTs, no rate limit, no
   webhook signature verification, raw cURL error disclosure, float-money
   rounding. Fix all of these if/when the tip-jar ships.

When to bring this back to root:
- Stephen confirms a web companion / tip-jar site is shipping.
- A real `stripe-config.php` is provisioned on the server (NEVER committed).
- The security issues above are addressed.
- A signed webhook endpoint exists alongside this one.

Until then, leave it parked.
