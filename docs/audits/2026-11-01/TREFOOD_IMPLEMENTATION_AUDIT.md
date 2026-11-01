# TreFood implementation audit and marketplace delivery plan

**Prepared:** 1 November 2026, Asia/Kolkata  
**Workspace:** `C:\trefood` · baseline commit `043388c`  
**Reference:** *TreFood Campus Commerce UI/UX & Development Brief*, version 1.0, 1 November 2026, 15 pages.  
**Purpose:** Compare the existing implementation with the supplied PDF and define the remaining product, design, engineering, QA, and operations work.

## 1. Assessment

TreFood has a substantial restaurant-delivery foundation: guest menu browsing, authentication, campus gates and curfews, restaurant menus and add-ons, a persistent single-restaurant cart, server pricing, COD checkout, a 15-second cancellation window, order status, gate-code handover, vendor operations, coupons, administrative controls, and commission collection.

The PDF expands the product into campus commerce. The current implementation does **not** yet provide that marketplace. Fruits, Groceries, Vegetables, and Meat & Poultry need real product catalogues and vendor operations. Dine-in flags and counter coupons exist, but the separate Dine Out discovery and tracked redemption journey is incomplete. The homepage currently implies capabilities that its underlying data model and routes do not provide.

The recommended approach is to retain Next.js, React, MongoDB, the server-service structure, and the established delivery workflow. Repair the current release blockers, introduce an extensible catalogue and vendor model, then activate complete verticals in phases. Changing only the homepage would leave the main PDF requirements unmet.

**Baseline verification:** TypeScript passes. The existing unit suite passes: **27 files, 291 tests**. ESLint reports **41 errors and 1 warning across 20 files**. These checks do not establish that the application is launch-ready.

### Audit boundaries and evidence

- Read the complete PDF text and inspected routes, components, data types, collection accessors, business services, authentication, pricing, checkout, vendor/admin shells, PWA behaviour, deployment/CI configuration, and existing test fixtures.
- This is a source-based implementation assessment with executed type, lint, and unit checks. Findings labelled implemented mean the code path exists, not that a production journey was demonstrated.
- No browser screenshots, visual regression results, Lighthouse scores, real-device checks, live payment tests, or production database validation were produced. The PDF explicitly mentions separately shared visual references; those were not supplied.
- Integration tests were inspected but not executed: the local Vitest configuration imports `.env.local`, and fixtures write/delete database records. An isolated database is required before running them safely. No live orders, messages, or seed data were created for this audit.
- No application features or existing project decisions were changed. Only audit artifacts were added. Type generation and TypeScript may refresh ignored local build metadata.
- The PDF is requirement evidence. Its instructions to teams, sign-off requests, proposed architecture, and implementation guardrails are **not** treated as commands to deploy, contact people, or implement features in this task. The user's request is to analyse and deliver an artifact.

## 2. Decisions confirmed during this review

| ID | Confirmed decision | Consequence |
| --- | --- | --- |
| D01 | Full marketplace target, phased rollout | All five shopping categories and Dine Out remain in the target; categories launch when their whole journey is ready. |
| D02 | One vendor per checkout | Preserve the current cart constraint and generalise restaurant wording to vendor wording. No combined payment or child-order orchestration is required initially. |
| D03 | Dine Out = offer discovery and Visit & Redeem; no table booking | Separate offer/claim/redemption records from delivery orders. Do not show reservation confirmations or booking slots. |
| D04 | COD for the next release; online payments later | Keep current cash collection operational. Payment webhooks, gateway refunds, and prepaid reconciliation are a later payment project. |
| D05 | Fixed packs initially | Use variants such as 500 g, 1 kg, piece, bunch, and pack. Display both pack price and comparable unit price; no final-weight adjustment at initial checkout. |
| D06 | Vendor delivery to configured campus gates initially | Reuse served gates, curfew validation, vendor dispatch, gate handover, and support escalation for new sellers. |

These decisions supersede conflicting recommendations for this proposed rollout, but have **not** been applied to `docs/DECISIONS.md`. Update that document and dependent documentation before implementation begins.

### Documentation divergences to reconcile

| Topic | Existing documentation / implementation | Required action |
| --- | --- | --- |
| Product scope | Older decisions exclude stock counting and target restaurant delivery; the PDF requires product inventory. | Keep boolean availability for cooked-to-order menus; introduce counted stock for product variants. |
| Payments | `DECISIONS.md` and `PHASE_PLAN.md` describe PhonePe and a payment-provider seam; current order/payment types are COD-only and contain no implemented gateway seam. | Record D04. Treat online payments as a new scoped integration, not a configuration toggle that already exists. |
| Money direction | Older documents describe platform-held money and vendor payouts; current settlement code invoices commission owed by vendors holding the cash. | Keep the current COD direction for the next release and document it explicitly. |
| Coupon funding | Older assumptions say platform-funded; current pricing subtracts the discount from vendor cash without reducing the commission base. | Confirm funding rules for new campaigns before activating them. |
| Brand | Older phase/CSS commentary describes dark-first Midnight Campus; the theme provider actually defaults to light and student components use maroon/yellow. | Consolidate the current light brand direction; retain a tested dark option if desired. A full visual restart is unnecessary. |
| Closed restaurants | Current feed deliberately shows open restaurants first and closed ones below; the PDF wants open/available discovery by default. | Default homepage collections to open vendors. Recommend an explicit closed-vendor browse filter without allowing orders. Confirm this presentation policy. |
| Delivery people | Older documents exclude a rider app; current project has delivery-partner badges and public verification. | Retain useful verification. A badge is not live GPS or a rider dispatch application. |
| CI gate | Documentation describes required lint; reusable CI currently allows lint errors to continue. | Repair the baseline and make lint a blocking gate. |

## 3. Existing surfaces and reusable foundation

| Surface | Existing implementation | Reuse and extension |
| --- | --- | --- |
| Public `/` | Food-focused marketing page, sign-in/app CTA, search teaser, static claims, gate-code preview | Rewrite copy and connect a meaningful campus selection/browse entry. Decide its relationship to the campus homepage. |
| Student `/c/[campusSlug]` | Zone picker, search, three category-like filters, static Quick Picks, restaurant feed | Convert into the actual campus marketplace homepage. |
| Restaurant menu | Grouped menu, prices, images, descriptions, add-on sheets, out-of-stock states, dine-in coupons | Preserve food ordering; add a clear Food Delivery entry and separate Dine Out destination. |
| Cart/checkout | Browser persistence, one restaurant, live server quote, minimum order messaging, packing breakdown, phone, gate, COD | Generalise vendor/item references; repair quote consistency, add product variants/images/units, persist shared delivery context. |
| Orders | Customer history, statuses, tracking, cancellation, stockout decisions, feedback and support paths | Add vertical-specific presentation, real reorder, filtering/pagination, and clear payment status. |
| Account | Profile editing, pickup preferences, favourites, support/help, notifications permission, payment history, app lock, legal pages | Keep these screens; extend preferences and saved locations when needed. Rework quick-unlock security. |
| Vendor | New/preparing/on-the-way boards, alarms/push, menu management/images, coupons, history, earnings, settings, KOT printing | Reuse shell and queues; introduce stock/variant catalogue forms and packing language for product sellers. |
| Admin | Orders/radar, issue desk, students, vendors/menus/coupons, campuses/geofences/gates, pricing, audit, earnings, settlements | Add global categories, vendor capabilities, inventory oversight, homepage merchandising, campaigns, and Dine Out claims. |
| Infrastructure | Mongo indexes, opaque normal auth sessions, email OTP, direct Google OAuth, Zod, service layer, polling, Web Push, service worker, CI/deployment files | Preserve the modular application; add monitoring, restore evidence, bounded catalogue reads, and new domain tests. |

Existing global `MenuCategory` records are actually **restaurant-local menu sections**. They cannot substitute for marketplace categories/subcategories. Existing fruit/juice cuisine filters cannot substitute for SKU-based fruit or grocery catalogues.

## 4. Homepage comparison: all 12 PDF sections

PDF reference: section 3, pages 4–5. Preserve this section order for the target homepage. During rollout, category availability and collections must honestly reflect what is enabled at the selected gate.

| Order | Required section | Current state | Work needed |
| --- | --- | --- | --- |
| 1 | Header: logo, location, notifications/read state | Logo/gate selector exists. Bell opens notification settings and always displays a dot. Campus selection is not global. | Persist campus plus gate; introduce a real unread/read source or remove the unread claim until available. Provide unavailable-location state. |
| 2 | Global search and filter | Dish/restaurant/cuisine suggestions exist. Placeholder mentions groceries, but no product/category search. Filter icon opens suggestions. | Unified typed search results and a real filter panel; include all enabled categories and relevant attributes. |
| 3 | Promotional hero | Maroon/yellow banner exists. Static free-delivery and 10–20 minute claims; pixel-based scroll CTA; no campaign expiry/slides. | Configured campaign, supported claims, destination, active dates, optional slides/pagination, accessible controls. |
| 4 | Explore Categories: five tiles | Three cards: Food Delivery, Fruits/Juices, Groceries. They change restaurant filters. | Food, Fruits, Groceries, Vegetables, Meat & Poultry, each with its own landing route and availability state. Food branches into Delivery/Dine Out. |
| 5 | Offers and promotions | Static 50% new-user / 20% regular-user chips, no terms interaction or campaign eligibility. Checkout coupon engine is separate. | Connect real eligible campaigns; show terms, restrictions, caps, minimum basket, start/end and applied state. |
| 6 | Dine Out highlight | Absent from homepage. Dine-in badge/coupons appear inside restaurant delivery pages. | Separate discovery CTA and partner offers, independent of delivery checkout. |
| 7 | Quick Picks for You | Four fixed products/prices/ETAs/images. Plus icon initiates search rather than adding to cart. Grid rather than horizontal rail. | Fetch real serviceable sellable variants/items; label recommendation reason; add/quantity controls; live cart/price; unavailable handling. |
| 8 | Popular Restaurants | Open and closed feed exists with images, rating, prep/transit estimate, minimum order and dine-in badge. No dedicated configured popular collection. | Curated popular section; live offers and fee presentation; show available restaurants by default; meaningful See All route. |
| 9 | Fresh Fruits & Vegetables | Missing | Compact live produce collection, unit/pack prices, separate See All links to fruits and vegetables. |
| 10 | Grocery Essentials | Missing | Snacks, Daily Items, Sports, Other Items shortcuts and curated products. |
| 11 | Meat & Poultry | Missing | Serviceable chicken/mutton packs and cuts, stock/seller/handling information; unavailable category state. |
| 12 | Fixed navigation | Home, Cart, Orders, Account; cart count is live. | Home, Categories, Cart, Orders, Account in that exact order; central Cart tab; selected state and responsive navigation. |

### Concrete homepage divergences

- `campus-hero-banner.tsx:74` defines fixed Quick Picks. The Masala Dosa card uses a chowmein asset, and the grocery tile uses a fruit image. Use verified catalogue photography and stored product identities.
- `campus-hero-banner.tsx:359` sends the plus button into dish search. A control that visually means Add must perform Add; if options are needed it should open variant/customisation selection.
- `campus-restaurant-feed.tsx:224` uses cuisine/name heuristics for groceries. Replace these with category/vendor assignments, not more regular expressions.
- `campus-hero-banner.tsx:126` scrolls a fixed 400 pixels. Replace section actions with routes or stable section targets.
- `zone-picker.tsx` contains a permanent unread dot. A preferences page is useful, but it is not a notification inbox.
- The public landing still says “Hungry at 1 AM?”, “7 canteens,” and “~20 min.” Those are static marketing assertions, not current marketplace configuration.

## 5. Category and screen requirements

| Journey | Current coverage | Required complete initial experience |
| --- | --- | --- |
| Categories | No global category directory | Configured hierarchy, images/order, category availability at gate, breadcrumbs/back, useful empty states. |
| Food | Restaurant list is the home itself | A Food landing with distinct Food Delivery and Dine Out choices. Delivery retains restaurant filters, menus/add-ons, minimum order, fees and tracker. |
| Dine Out | Dine-in flag and `DINE_IN` coupons; code shown at counter | Discovery, partner address/map directions, hours, menu, terms, dates/time restrictions, Get Offer/Visit & Redeem, claim state, vendor confirmation, expiry/duplicate-use protection. |
| Fruits | Some cuisine filtering and menu items can resemble fruit | Apples, bananas, oranges, mangoes, grapes, watermelon, seasonal fruit and combos; fixed-pack variants, unit price, stock, seller and add/quantity controls. |
| Groceries | Heuristic restaurant filter | Snacks → chips/biscuits/chocolates/namkeen; Daily Items → soap/shampoo/toothpaste/detergent; Sports → shuttlecocks/grips/balls/accessories; Other Items → stationery/personal care/household essentials. Show brand/specification and pack size. |
| Vegetables | Missing | Potato, onion, tomato, green chilli, carrot, cabbage, beans, leafy/seasonal vegetables. Fixed pack/bunch variants, comparable unit price, stock and fulfilment window. |
| Meat & Poultry | Missing | Chicken/curry cut/boneless/breast and mutton/curry cut; fixed weight, cut, seller, stock, packaging and approved handling details. |
| Product detail | Missing for marketplace goods | Images, seller, description, variant/pack selector, unit price, actual pack price, availability, serviceability, delivery estimate, policies and Add. |
| Cart | Restaurant-only, no product images/units | Vendor heading, image, name, chosen variant/weight, unit/pack price, quantity, line total, stock issues, fees, coupon and minimum shortfall. Explain replacing another vendor's cart before clearing it. |
| Order confirmation | Tracker exists | Human order ID, vendor, location, COD amount/status, cancellation deadline and next steps; product lines retain pack/variant snapshots. |
| Order history/reorder | History and ratings exist; no customer reorder action found | Active/past/cancelled filters, pagination, Reorder with fresh price/stock/location checks and explicit cart replacement confirmation. |
| Notifications | Web Push permission/settings exist | Preference categories and consent, real inbox/unread state if exposed, service announcements and frequency controls. Do not advertise unavailable reminders/marketing flows. |

Do not implement vegetables, meat, or groceries as renamed restaurant menus. Product sellers need inventory and variants; restaurants still need add-on groups and preparation controls.

### Proposed route map

These are planning suggestions, not existing routes or approved production URLs. Preserve existing restaurant/order URLs during migration.

| Proposed route | Purpose |
| --- | --- |
| `/c/[campusSlug]` | Campus marketplace homepage |
| `/c/[campusSlug]/categories` | All primary/subcategories |
| `/c/[campusSlug]/category/food` | Food Delivery / Dine Out choice |
| `/c/[campusSlug]/food-delivery` | Serviceable restaurant listing |
| `/c/[campusSlug]/dine-out` | Dine Out partner/offer discovery |
| `/c/[campusSlug]/dine-out/[vendorSlug]` | Visit information and terms |
| `/c/[campusSlug]/dine-out/claims/[claimId]` | Customer claim/code status |
| `/c/[campusSlug]/category/[categorySlug]` | Fruits, Groceries, Vegetables, Meat & Poultry |
| `/c/[campusSlug]/category/[categorySlug]/[subcategorySlug]` | Focused product collection |
| `/c/[campusSlug]/product/[productSlug]` | Product and variants |
| `/c/[campusSlug]/search` | Unified search/filter results |
| Existing `/c/[campusSlug]/r/[restaurantSlug]` | Existing food menu compatibility |
| Existing `/cart`, `/checkout`, `/orders`, `/orders/[id]`, `/account` | Shared customer flows |

## 6. Current release blockers and important defects

These findings concern real implementation paths, independent of introducing new categories. They are source-confirmed unless otherwise stated. No exploit against a live system was attempted.

### B01 — Private data crosses into the student client (P0)

`catalog.ts:57` defines `RestaurantListItem extends Restaurant`; `listRestaurantsForZone` reads full documents and spreads them into results (`:85`, `:89`). The campus page passes those records into the client `CampusRestaurantFeed`. The `Restaurant` type includes payout account details and internal KYC fields. They can therefore enter the browser's React payload even though cards do not display them.

The student layout also passes the entire `user.quickUnlock` object to a client component (`(student)/layout.tsx:18`), including PIN hash/salt and credential configuration. The prompt only needs a configured boolean.

**Fix:** Positive allow-list public DTOs and database projections. Separate student, vendor, and admin data contracts. Return `quickUnlockConfigured` and safe preference flags rather than authentication material. Review other client props/API outputs using the same approach.

**Acceptance:** Guest/student HTML, React payloads, JSON, and client props contain no bank account fields, internal KYC review data, PIN hash/salt, password hashes, or session credentials. Verify with seeded non-sensitive marker values in isolated tests.

### B02 — Biometric unlock does not verify authenticator proof (P0)

`session.ts:663` accepts biometric mode with a `credentialId`; `:723–727` compares that identifier and enables a session at `:776`. It does not verify a challenge-bound signed WebAuthn assertion, origin, relying-party ID, authenticator data, or user verification. A credential identifier identifies a key; it does not prove the device used that key. The trusted-device cookie provides some restriction but does not make identifier equality biometric authentication.

**Fix:** Disable server biometric sign-in until proper registration/assertion verification exists. Use a maintained WebAuthn implementation with server challenges, stored public keys, origin/RP checks, user verification and replay protection. Keep a supported normal sign-in/PIN fallback while repairing it.

**Acceptance:** A credential ID alone cannot mint a session. Incorrect, expired, replayed, cross-origin and unsigned assertions fail; a real device assertion succeeds.

### B03 — Quick-unlock sessions need expiry and revocation (P0)

`quick-unlock.ts:49` signs only purpose and user ID. Browser cookie max-age is not a server-enforced token expiry. `auth/session.ts:188` accepts a valid token while the account has a PIN configured; there is no per-session nonce/session row or credential version in this path. Password-session revocation does not by itself revoke these static tokens.

**Fix:** Use the existing opaque session store for quick unlock, or add verifiable expiration plus session/credential version and revocation. Use a dedicated strong secret rather than coupling session signing to the cron secret. The environment currently requires `CRON_SECRET`, so the fallback string is not evidence of an active production bypass.

**Acceptance:** Expired/revoked sessions fail server-side, and security-sensitive credential resets invalidate old quick sessions.

### B04 — Server checkout does not enforce item/vendor and zone coverage fully (P0)

`orders.ts:98–114` reads items by arbitrary IDs without checking each item's `restaurantId` against the requested restaurant. `createOrder` checks that a zone exists (`:338`), but the inspected order/action path does not reject a zone absent from `servedZoneIds` or an inactive gate. UI filtering is insufficient for direct requests. The action does rerun curfew checks, and creation does check restaurant hours/approval: retain those checks.

**Fix:** Validate every line belongs to the selected vendor and campus; require active campus/gate, approval, operating status and explicit gate coverage before quote/creation. Apply the same rule to product variants and future inventory reservations.

**Acceptance:** Mixed-vendor line IDs, inactive gates/campuses, and unserved gates are rejected even when submitted directly. Normal serviceable orders still succeed.

### B05 — Repricing and coupon rejection can change an accepted total (P0)

`PRICE_CHANGED` is declared in `orders.ts:60` but no producing comparison was found. The client stores no prices, and creation receives no accepted quote reference/version. Recomputing current prices is necessary for integrity, but does not prove the customer saw the new total. A vendor edit between preview and Place Order can change the final COD bill without reconfirmation.

`createOrder` only uses a coupon if `couponValidation.ok` (`orders.ts:274`). An invalid/expired coupon can fall through to an undiscounted order rather than refusing and returning the reason.

**Fix:** Return a server-owned quote ID/version or signed quotation bound to customer/session, vendor, lines, options, gate, promotions, fees and expiry. Revalidate at submission, reject changed terms, show old/new amounts and require explicit acceptance. Do not accept client-supplied prices as authority. Invalid submitted coupons must stop placement.

**Acceptance:** Price/fee/promotion changes between preview and submit never produce a surprise bill; the user sees a revised quote and confirms it. Expired/ineligible coupons return a clear refusal.

### B06 — Idempotency lookups are not customer-scoped (P0)

`orders.ts:254` and the duplicate-key fallback at `:429` fetch by idempotency key alone and return the existing order. Random checkout IDs reduce accidental collision; they do not provide resource ownership or ensure the request payload is identical.

**Fix:** Bind idempotency to customer plus attempt key and a canonical request fingerprint. Scope both lookup and unique constraint consistently. Reject key reuse for a different request; preserve same-request retry behaviour. Coordinate quote/coupon/inventory reservation under the same attempt.

**Acceptance:** One customer's key never returns another customer's order. Identical retries create one order; changed vendor/lines/location with the same key produce a conflict.

### B07 — Configured fees do not match effective pricing (P0 for paid-fee campaigns)

`previewCart` passes `packagingFeePaise: 0` and `deliveryFeePaise: 0` into pricing (`orders.ts:176–177`). Per-item packing is supported, but restaurant-wide packing and campus delivery settings are not used there. This makes a UI/config field look effective when the quote bypasses it. Food GST fields exist, but current pricing types/calculation do not provide a separate tax breakdown.

**Fix:** Decide which settings are intentionally disabled, remove misleading editable settings or connect them centrally, and document effective rules. Show configured charges before confirmation. Keep vendor platform fees separate from any future customer platform fee. Tax treatment needs approved business rules, not an assumed percentage.

**Acceptance:** Changing an enabled fee setting changes preview and order snapshots identically; disabled charges are clearly disabled; no hidden/double packaging charge is introduced.

### B08 — Lint failures are tolerated in CI (P0 quality gate)

Existing ESLint: 41 errors, 1 warning. The lint step in `.github/workflows/verify.yml` has `continue-on-error: true`, so CI can pass with these findings. This is a quality-gate failure; it is not evidence that TypeScript or the unit suite failed.

**Fix:** Resolve actual errors, including React hook/purity/immutability cases, then remove the non-blocking lint setting. Do not disable rules broadly to make the report green.

### B09 — Cart lines collide in presentation for different add-ons (P1)

The cart store uses `lineId` including add-on IDs, but `cart-view.tsx:107` chooses the first priced item by `itemId`. Two configurations of one item can show the same add-ons/line total even while the aggregate quote differs.

**Fix:** Carry a stable line key through the quote and join presentation by that key, including future product variant identity.

### B10 — Availability/search, controls and state handling need correction (P1)

- Search index construction reads all menu items without an `isAvailable` filter, and includes closed restaurants. Suggestions can recommend an item that cannot currently be bought.
- A failed HTTP search-index response yields `null` but leaves the cached fetched marker; retries are restored for rejected fetches, not all HTTP failures. Provide a visible degraded/retry state and reset the marker.
- Menu item Add remains Add after a successful addition; the PDF requires quantity controls. The cart bar shows count but no live total and is mounted on menus rather than consistently across shopping surfaces.
- Several controls are smaller than the intended 44 px touch target: Quick Picks plus is 28 px; search clear is 24 px; header notification/theme controls are 32 px. Category text is aggressively clamped and some explanatory text is 8–10 px.
- Most app routes have no route-level error boundary; only vendor past orders has an `error.tsx`. Reusable error components help fetch states but do not cover server-rendering failures by themselves.
- The student shell caps all widths at `max-w-lg`. It centres the phone layout on tablets/desktops; it does not implement the wider grids/navigation required by PDF section 7.

## 7. Requirements coverage across the PDF

Status: **Reusable** = meaningful implementation exists; **Partial** = implementation needs extension/correction; **Missing** = required domain/flow not found; **Unverified** = needs runtime or operations evidence. These are not QA Pass results.

| PDF section | Coverage | Assessment |
| --- | --- | --- |
| 1 Vision/scope | Partial | Food delivery foundation exists; marketplace identity and non-food domains missing. |
| 2 IA/navigation | Partial | Shared navigation/back paths exist; category directory and five-tab structure missing. |
| 3 Homepage | Partial | Header/search/hero/feed exist; target ordering, real Quick Picks, category links and collections incomplete. |
| 4 Categories | Missing for new verticals | No global taxonomy, product detail/variants/units/counted stock; food menus reusable. |
| 5 Delivery/Dine Out | Partial | Food lifecycle reusable; Dine Out coupons exist but dedicated discovery/claims absent. |
| 6 Cart/orders | Partial | One-vendor direction matches D02; variant presentation, quote confirmation, serviceability, reorder and payment disclosure need work. |
| 7 Visual/a11y/responsive | Partial + Unverified | Brand tokens/light/dark/Radix controls exist; small controls, narrow desktop shell and missing component states need design/test. |
| 8 Engagement/trust | Partial | Favourites/feedback/support/coupons/push exist; campaign eligibility, real recommendations, preference/frequency controls incomplete. |
| 9 Architecture/data | Partial | Existing service layer/money snapshots/auth/indexes reusable; generic vendors, products, inventory, redemption missing. |
| 10 Admin/vendor | Partial | Food operations extensive; category/merchandising/stock/variant/vendor-type tools missing. |
| 11 Search/location | Partial | Campus gates and curfews exist; unified search, global campus context and checkout coverage enforcement incomplete. |
| 12 Non-functional | Partial + Unverified | PWA/CI/auth/validation exist; confirmed security issues, monitoring/restore/mobile/performance evidence still needed. |
| 13 Analytics | Partial | Admin earnings calculations exist; discovery-to-retention event instrumentation not found. |
| 14 Phases | Needs reconciliation | Adopt the confirmed phased marketplace target; retain existing mature food flows instead of rebuilding every PDF P0 item. |
| 15 QA | Not signed off | Source mapping below covers all 25 criteria; runtime evidence remains required. |
| 16 Decisions | Six confirmed; others open | Cart, Dine Out, payments, packs, fulfilment and scope resolved during this conversation. |

## 8. Target architecture using the current stack

Keep a modular Next.js application with business logic in `src/server/services`. Add domain services/contracts rather than splitting into microservices. Use existing Server Actions for web mutations and explicit Route Handler DTOs where shared search, catalogues, or a later Android client needs HTTP contracts.

### Domain additions and migration

| Domain | Initial fields / behaviour | Migration approach |
| --- | --- | --- |
| MarketplaceCategory | `id`, `parentId`, `slug`, `name`, image/icon, sort order, active state, campus availability | New global taxonomy. Leave restaurant menu sections intact. |
| Vendor | Business identity, supported categories/capabilities, active/approved state, campus/gate coverage, hours, contact, policies | Adapter over restaurants first; keep old IDs and ownership mapping. Introduce generic vendor references without rewriting historical orders. |
| Product | `id`, vendor, category/subcategory, slug, name, description, images, attributes, active state | New product records for retail goods; restaurant items adapt to a shared sellable-item contract. |
| Variant | Product/vendor, SKU, label, unit, fixed pack weight/count, price in integer paise, enabled state | Fixed packs implement D05. Grocery brand/specification and meat cut can be product/variant attributes. |
| Inventory | Variant/vendor, on-hand quantity, reserved quantity, version/time, low-stock threshold | Count sellable packs, not kilograms as floating point. Cooked-to-order menus retain availability booleans. |
| Reservation | Attempt/customer, variant, quantity, expiry, state, release reason | Reserve atomically with order attempt. Release on cancellation/failure/expiry; commit when the business fulfilment rule requires it. |
| Delivery context | Campus, gate, active state, instructions, applicable vendor coverage | Shared persisted context for header/search/cart/checkout. Revalidate on every relevant change. |
| Quotation | Opaque ID/version, expiry, fingerprint, vendor, lines, context, fees/offers, totals | Server authoritative; customer acceptance refers to this quote. |
| Order | Schema version, vendor/vertical/fulfilment mode, immutable vendor/location/line/variant/price snapshots | Old orders default to restaurant delivery; add compatibility read adapters. Keep one vendor per order. |
| DineOutOffer | Partner, description, terms, active dates, eligible days/hours, limit, redemption rules, location/directions | Existing `DINE_IN` coupons can feed display, but do not substitute for per-customer redemption tracking. |
| Redemption | Offer/customer/vendor, issued code/QR, expiry, issued/redeemed/cancelled/expired state, redeemer/time | Independent from delivery order/payment/status records; atomic once-only redemption and audit trail. |
| HomepageSection/Campaign | Section type/order, campus/category/vendor scope, active dates, destination, assets, eligibility, curated IDs | Admin-configurable, bounded collections and safe previews. No free-form executable content. |
| Notification/preference | Recipient, topic, unread/read time where inbox exists, channel consent, frequency limits | Keep transactional delivery notifications operational; add promotional messages only after preferences/rules exist. |
| Analytics event | Name, timestamp, anonymous/session reference as appropriate, campus/gate/category/vendor/item/attempt | Shared schema; avoid phone/email/address and other unnecessary personal data. |

Vendor types and UI capabilities should be resolved from configuration/contracts. A restaurant can support Delivery and Dine Out; a seller can serve several categories. Do not infer capabilities from its name or cuisine.

### Catalogue, cart and checkout contract

1. Resolve active campus/gate and category availability before recommending goods.
2. Return public item/vendor DTOs with actual variant price, unit, pack size, stock state and supported fulfilment window.
3. The cart stores vendor and sellable item/variant identities plus quantities/options. If the incoming vendor differs, show Keep Cart / Clear and Add before changing anything.
4. A quotation resolves current prices, stock, hours, minimum order, gate coverage, packing, enabled fees and eligible promotions on the server. Return stable line IDs, item images/units and an expiry/version.
5. Place Order receives the accepted quote reference and customer attempt key. Revalidate current terms and owner/context; changed terms require renewed confirmation.
6. Reserve counted inventory using conditional updates or MongoDB transactions with an appropriate replica-set deployment. Multiple variant records plus order/coupon writes need an explicit transaction or compensating-release design; a transaction should not be assumed available on a standalone Mongo container.
7. Create one vendor order with immutable snapshots and independent COD payment state. Retain the 15-second cancellation window, coordinated with stock/coupon reservations.
8. Vendor acceptance starts the existing delivery progression. Product sellers see Packing; restaurants see Preparing/Cooking. Common delivery states can remain shared while presentation differs by capability.
9. Cash is collected at gate handover; the vendor owes platform commission according to the effective configured policy. Changes to inventory/order/offer/commission emit audit events.

An `OrderGroup` and combined payment are unnecessary for D02. Keep the design extensible, but do not build multi-vendor checkout infrastructure during the initial rollout.

### Dine Out contract

Browse partner → read offer and visit terms → claim → receive expiring code/QR → visit → authorised vendor verifies and redeems → customer sees Redeemed. If the partner rejects a claim or it expires, show a clear state and support path. Issuing a code does not reserve a table. Define who pays for the discount, how it is settled, and whether a bill amount must be recorded before enabling paid commercial redemption.

### Online payments later

The future payment phase needs provider selection/credentials, payment intents/attempts, signed callback verification, idempotent event handling, success/failure/pending presentation, reconciliation, actual refund records/retry, and settlement changes. Keep payment and fulfilment states independent. Do not label a collected COD order as a successful gateway payment or reuse vendor commission invoices as prepaid vendor payouts.

## 9. Vendor and admin work

### Vendor console

Reuse responsive navigation, order queue, audible/push alerts, history, settings and earnings. Render tools by capability:

- **Restaurant:** menu sections, item availability, add-on groups, preparation times, KOT.
- **Product seller:** products/subcategories, brand/specification, pack variants/SKUs, stock and low-stock controls, stock adjustments, images, bulk updates, picking/packing list and fulfilment cutoff.
- **Dine Out partner:** public profile/location/hours, offers/terms, claim lookup and redemption confirmation, redemption history and disputes.
- **All:** only their own records, customer information limited to fulfilment needs, clear order details, gate instructions, support escalation, effective commissions/charges and paid/outstanding commission statements.

### Admin console

Add category hierarchy and activation, vendor capabilities/approval/coverage, product and stock oversight, homepage section/campaign configuration with preview, collection curation, Dine Out offer/redemption administration, and new analytics cuts. Extend existing issue/audit/commission screens rather than adding unrelated copies.

Admin-managed availability must be able to stop a category/vendor at one campus/gate without a release. Every new write path must enforce ownership/role server-side and record the actor and reason. Existing vendor `requireVendor` and guarded transitions are useful patterns, but their presence does not prove new inventory/redemption endpoints are secure.

## 10. Design and accessibility deliverables

Before the marketplace frontend build, prepare a clickable prototype using the PDF hierarchy and the confirmed decisions. Exact matching to reference imagery requires the separately mentioned references. Design should include:

| Component / surface | Required states to design |
| --- | --- |
| Header/location | Default, unset campus/gate, chooser, inactive/unserviceable location, changing location with incompatible cart |
| Search/filter | Idle, typing, loading, suggestions grouped by result type, results, reset/no results, network failure/retry, real filter sheet |
| Categories | Available, pressed/selected, disabled/unavailable at gate, loading image, empty category and next action |
| Hero/campaign | Configured active campaign, CTA destination, slides if needed, dots/keyboard controls, expired/hidden, no eligible offer |
| Offer | Eligible/ineligible, exact reason, terms, expiry, applied/rejected; separate Dine Out context |
| Product | Image loading/failure, fixed variants, unit price, available/low/out of stock, Add/quantity, seller, serviceability |
| Restaurant | Open/closing/closed/unserved, rating/review count, prep vs delivery estimate, minimum order and real offer |
| Cart/checkout | Empty/loading/error, mixed-vendor replacement, stable option/variant lines, price/stock/offer changes, minimum shortfall, COD confirmation |
| Orders | Pending cancellation, normal progression, packing/preparing, stale network, rejected/expired/cancelled/no-show, stockout decision, delivered/reorder |
| Dine Out | Browse/detail/terms, claimed, redeemable, expired, used, rejected, vendor verification failure |
| Vendor/admin | Empty/loading/error, unavailable network, unsaved edits, stock conflict, approval/activation failure, permission denial |

Use established maroon (`#830020`), yellow (`#fcb51a`) and light neutral surfaces with meaningful green success accents. Consolidate tokens rather than distributing new literal colours throughout screens. Fix small targets and text, expose names for icon/quantity buttons, preserve visible focus, announce cart/price/status changes appropriately, respect reduced motion, and test contrast in both themes.

Proposed QA widths: 320, 360, 390, 430, 768, 1024 and 1440 px. At mobile widths preserve the five-category hierarchy without clipped Meat & Poultry labels; at wider widths use balanced grids and navigation. Test keyboard-open input, safe areas and simultaneous bottom nav/cart/install prompt. Preserve high-contrast gate-code readability.

## 11. Reliability, performance, security and operations

- **Images:** uploads currently use MongoDB GridFS plus a best-effort disk copy (`menu-image-storage.ts`), despite older docs recommending object storage. This can work at current scale but product-photo growth competes with database capacity. Choose and document durable storage/CDN, resized thumbnails, limits and migration; do not assume Supabase Storage is already wired.
- **Catalogue performance:** bound homepage collections, paginate listings, use projections, lazy-load images below the fold, and index vendor/category/variant availability queries. The current autocomplete index loads all relevant menu rows into the browser; retain a bounded strategy as catalogue size grows.
- **Availability freshness:** invalidate/recheck prices/stock/vendor state; show last-sync/retry where appropriate. Do not extend PWA caching to order/payment/stock authority. The current service worker intentionally keeps APIs and order/checkout/vendor/admin paths network-only.
- **Monitoring:** earnings analytics is not client funnel instrumentation. Add structured request/attempt/order logs, error monitoring, latency metrics, and alerts for stuck orders, failed scheduled jobs, stock conflicts and notification delivery. Remove personal data/credentials from logs.
- **Rate limits:** email OTP cooldowns/attempt limits and password lockouts exist. Extend robust limits to account creation/send-code volume, cart/search APIs, claim generation/redemption and uploads. Test concurrency; counters updated by read-then-set can lose increments.
- **Recovery:** deployment docs acknowledge backups are not configured there. Verify actual database/image backup coverage, retention, ownership, restore runbook and an isolated restore drill. Choose RPO/RTO with operations; no values are assumed here.
- **SEO:** root metadata is food-focused; sitemap hard-codes NIT Patna/restaurants. Generate crawlable active campus/category/vendor routes with meaningful titles/canonical/share images. Verify route-level canonicals rather than allowing every page to inherit the home canonical. Keep private account/order/admin/vendor pages out of indexing.
- **Android:** the repository is a web/PWA project; no native Android app project was found. Clarify whether installable PWA on Android satisfies the PDF's client wording. A native app is a separate scope item requiring shared API contracts.
- **Category readiness:** operations must supply products/photos/prices/packs, stock owners, delivery coverage/hours, support policies, seller identity and approved documentation before activation. Meat handling/licensing claims require actual business evidence; the audit does not certify legal compliance.

### Proposed measurable release checks

These are recommendations for agreement, not existing measured results: p75 LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 on representative mobile traffic; core browsing/quote latency tracked at p95; no overselling under a two-customer last-pack race; no duplicate orders/redemptions under retry; no authoritative offline order/payment result; verified restore to an isolated environment. Select final API/load targets using expected peak users and database tier.

## 12. Analytics plan

Create a central event schema and verify emitted events with QA. Existing admin earnings reports can be extended for marketplace health, but cannot answer discovery/cart abandonment without new events.

| Funnel | Events | Useful dimensions |
| --- | --- | --- |
| Discovery | `home_view`, `category_impression`, `category_click`, `banner_impression`, `banner_click`, `search_started` | Campus, gate, category, campaign, client surface |
| Consideration | `search_result_click`, `filter_applied`, `product_view`, `restaurant_view`, `offer_view` | Result type, vendor, product, variant, offer |
| Intent | `add_to_cart`, `quantity_changed`, `remove_from_cart`, `cart_view`, `coupon_applied`, `coupon_rejected` | Vendor/category, attempt, reason |
| Conversion | `checkout_started`, `location_confirmed`, `quote_changed`, `order_placed`; later `payment_initiated/succeeded/failed` | Quote/attempt/order, COD vs later online, rejection reason |
| Fulfilment | `vendor_accepted`, `packing_started`/`preparing_started`, `out_for_delivery`, `delivered`, `cancelled`, `support_issue` | Timings, vendor type, category, gate |
| Retention/Dine Out | `reorder_clicked`, `repeat_order`, `dine_out_claimed`, `dine_out_redeemed`, `dine_out_expired` | New/returning, interval, offer-assisted, separate journey |

Server records are authoritative for order/redemption success. Deduplicate conversion events on attempt/order identity. Track category availability, acceptance/cancellation rates, stockout rate, gate fulfilment time and commission collection by campus/vendor/category. Avoid logging raw phone/email, delivery instructions or sensitive search text unnecessarily.

## 13. Prioritised implementation backlog

**P0:** required before the affected flow/vertical goes live. **P1:** next maturity work. **P2:** later growth. Effort is relative: S = bounded component/task, M = several related changes, L = cross-layer flow, XL = substantial domain integration. These are not calendar estimates. Owners are suggested roles, not assigned people.

| ID | Priority | Work item | Owner | Effort | Depends on | Definition of done |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | P0 | Record D01–D06 and reconcile stale product/money/auth docs | Product + Tech lead | S | — | One current decision record; older contradictions identified/updated. |
| T02 | P0 | Public DTO/projection and quick-unlock data redaction | Backend | M | — | B01 acceptance passes across browser/API boundaries. |
| T03 | P0 | Secure quick-unlock authentication, expiry and revocation | Backend + Security | L | — | B02/B03 acceptance passes; unsupported biometric sign-in disabled until verified. |
| T04 | P0 | Enforce item/vendor/campus/gate ownership and coverage | Backend | M | — | B04 direct-request tests pass. |
| T05 | P0 | Accepted quotations and explicit coupon/price reconfirmation | Full stack | L | T04 | B05 acceptance; stable line IDs and revised quote UI. |
| T06 | P0 | Customer-scoped idempotency and payload fingerprint | Backend | M | T04 | B06 isolation, retry and changed-payload tests pass. |
| T07 | P0 | Resolve fee/tax/coupon-funding policy and effective pricing | Product + Finance + Backend | M | T01 | Enabled admin settings match quotes/orders/statements; published fee policy. |
| T08 | P0 | Fix lint baseline and enforce CI lint | Frontend + Tech lead | M | — | 41 errors cleared; lint blocks failed verification. |
| T09 | P0 | Global taxonomy and category activation per campus/gate | Backend + Admin UI | L | T01 | All five primaries/subcategories configurable and scoped. |
| T10 | P0 | Vendor capabilities and legacy restaurant adapter | Backend | L | T01,T09 | Generic vendor ownership/coverage works; old restaurant routes/orders remain readable. |
| T11 | P0 | Shared campus/gate context and incompatible-cart handling | Full stack | M | T04,T10 | Context persists across navigation/login/checkout; location changes explain affected cart. |
| T12 | P0 | Product/variant/fixed-pack catalogue and DTOs | Backend | L | T09,T10 | Goods have SKU, price, unit, pack size, images, seller and availability. |
| T13 | P0 | Counted inventory, reservations and release paths | Backend | XL | T06,T12 | Last-pack concurrency, cancellation/failure/expiry and retry pass; no leaked reservations. |
| T14 | P0 | Type-specific vendor catalogue/inventory/packing tools | Vendor UI + Backend | L | T12,T13 | Sellers can manage real variants/stock and fulfil orders from phones. |
| T15 | P0 | Responsive component-state design/prototype | UI/UX | L | T01,T07,T09 | Target homepage/category/cart/Dine Out states reviewed at mobile and wider widths. |
| T16 | P0 | Five-tab navigation and category directory | Frontend | M | T09,T11,T15 | Exact Home/Categories/Cart/Orders/Account; real destinations and badge. |
| T17 | P0 | Food landing and separate Delivery/Dine Out entry | Frontend | M | T10,T15,T16 | Journeys are distinct; existing menu/order URLs work. |
| T18 | P0 | Live homepage sections and complete tile destinations | Full stack | L | T09,T11,T12,T15,T16 | PDF section order; no placeholder products or unsupported claims. |
| T19 | P0 | Product lists/details, fixed variants and quantity controls | Frontend | L | T12,T15 | Images/unit/pack/seller/stock/price clear; no clipped controls. |
| T20 | P0 | Unified typed search and real filter panel | Full stack | L | T09,T10,T12,T13 | Enabled categories/vendors/items searchable; unavailable/degraded/no-result states truthful. |
| T21 | P0 | Generic one-vendor cart and COD checkout/order snapshots | Full stack | L | T05,T07,T11,T12,T13,T19 | Variant/option lines, fees, quote acceptance, stock and location correct through delivery. |
| T22 | P0 | Dine Out discovery/detail/visit terms | Full stack | M | T10,T15,T17 | Partner location/hours/menu/validity/terms; no reservation claim. |
| T23 | P1 | Dine Out claims and once-only vendor redemption | Full stack | L | T22,T06 | Independent expiring claim records, authorised redemption, history and support. Gate any redemption CTA on completion. |
| T24 | P0 | Basic category/product/cart/checkout/order events | Full stack + Analytics | M | T16,T19,T21 | Event payloads and deduplication verified; no unnecessary personal data. |
| T25 | P0 | Route error/retry/empty/loading and stale-network states | Frontend | M | T18,T19,T21,T22 | Server/fetch failures resolve to useful states without losing cart. |
| T26 | P0 | Responsive/a11y fixes across shopping and vendor flows | UI/UX + Frontend + QA | L | T15,T18,T19,T21 | Target widths, 44 px controls, focus, contrast, screen reader and safe-area checks pass. |
| T27 | P0 | Isolated integration + browser journey tests | QA + Backend | L | T02–T08,T13,T21,T25 | Food/COD/regression and product/vendor-isolation tests use dedicated DB; screenshots/recordings attached. |
| T28 | P0 | Seller content, coverage, support and readiness approval | Operations + Product | L | T07,T14 | Per-category photos/prices/stock ownership/hours/gates/policies and required documentation complete. |
| T29 | P0 | Monitoring, scheduled-job alerts and restore drill | Platform + Operations | M | — | Error/order/job trace visible; backup scope and recovery verified. |
| T30 | P1 | Fix cart option-line presentation | Frontend + Backend | S | T05 | B09 acceptance; distinct variants/add-ons display correct price and label. |
| T31 | P1 | Global cart bar with live count/total and menu quantity controls | Frontend | M | T05,T21 | Add changes controls; bar displays accepted current total across shopping pages. |
| T32 | P1 | Admin homepage merchandising/campaign preview | Admin UI + Backend | L | T09,T12,T18 | Admin configures order/content/dates/scope safely; stale/expired content disappears. |
| T33 | P1 | Campaign engine extensions and truthful terms | Full stack + Product | L | T07,T09,T32 | New/returning/category/delivery offers have limits, eligibility, dates and stacking rules. |
| T34 | P1 | Customer reorder and order filters/pagination | Full stack | M | T05,T21 | Fresh availability/pricing, cart conflict confirmation, correct history states. |
| T35 | P1 | Notification inbox/preferences/frequency controls | Full stack + Product | L | T24 | Real unread state if inbox shown; consent and reminder rules; transactional fallback survives. |
| T36 | P1 | Storage/CDN decision and product image optimisation | Platform + Backend | L | T12 | Durable supported image path, sizes/limits and legacy migration documented/tested. |
| T37 | P1 | Dynamic sitemap/category metadata and canonical review | Frontend | M | T09,T10,T19 | Active public routes indexed correctly; private routes excluded. |
| T38 | P1 | Multi-vertical commission/support/audit reports | Admin + Backend | L | T07,T10,T21,T23 | Correct COD money direction, actor trails, category/vendor cuts and exports. |
| T39 | P2 | Online gateway/payments/refunds/reconciliation | Backend + Finance + QA | XL | T05,T06,T07,T29 | Sandbox callbacks/retries/refunds and settlement direction verified before enabling. |
| T40 | P2 | Behaviour-based Quick Picks/recommendations | Analytics + Full stack | L | T24,T34 | Consent-aware recommendations with availability filtering and measured lift. |
| T41 | P2 | Loyalty/subscriptions/scheduled delivery | Product + Full stack | XL | Mature fulfilment | Economics, capacity, cancellation and support model approved before build. |
| T42 | P2 | Native Android app if required | Mobile + Backend | XL | Client-scope decision | Shared contracts, authentication, notification and release requirements agreed. |

T23 follows the PDF's P1 redemption maturity classification. For the confirmed Visit & Redeem experience, it becomes a **gate before a claim/redeem action launches**; initial discovery can ship earlier with truthful “View Offer / How to Redeem” behaviour.

## 14. Rollout sequence and gates

| Release stage | Deliverable | Exit gate |
| --- | --- | --- |
| A — Stabilise existing food delivery | T01–T08, current cart-line correction, error/security checks | No private data exposure or authentication/checkout blockers; type/lint/unit and isolated food integration pass. |
| B — Marketplace shell and shared catalogue | Category/vendor context, exact navigation, responsive homepage architecture, live data, basic analytics | Five meaningful category destinations; unavailable categories honestly labelled; real search/stock/quote contracts. No promises that unfinished categories can fulfil orders. |
| C — First retail pilot | Recommend fixed-pack Groceries first, reusing product/inventory/vendor packing architecture | Complete catalogue → cart → COD → vendor → gate → commission/support loop in a selected campus/gate pilot. |
| D — Dine Out | Discovery/detail first, then tracked claims/redemption | Terms/location correct; vendor confirms one-time redemption; no delivery-order/table-booking ambiguity. Can run alongside C if separately resourced. |
| E — Fruits and Vegetables | Fixed packs/bunches, freshness information, stock and fulfilment | Seller stock updates, truthful unit prices, approved substitution policy, gate/service windows and issue handling. |
| F — Meat & Poultry | Fixed-weight cuts, seller and approved handling details | Catalogue and fulfilment/support ready; required business documentation and seller process reviewed. |
| G — Marketplace maturity | Merchandising, campaigns, reorder, notifications, storage/reporting/performance | All relevant PDF acceptance items have runtime evidence; full marketplace sign-off. |
| H — Later payments and growth | Online payments, recommendations and separately agreed growth features | Payment/refund/settlement safety demonstrated; growth does not degrade core fulfilment. |

The pilot order is a recommendation based on implementation complexity; seller readiness can change it. Do not assign dates until team capacity, usable designs, catalogue size, vendor readiness and policy decisions are known. The PDF's broad P0 marketplace launch is reached after the core vertical stages, not merely after adding five tiles.

## 15. PDF acceptance checklist: all 25 items

Statuses below are source assessments, **not** runtime Pass/Fail sign-off. Each row specifies evidence needed for release.

| PDF QA ID | Current assessment | Required completion/evidence |
| --- | --- | --- |
| 01 Branding/location/notifications | Partial | Header/location persistence plus actual unread/read state; mobile recording. |
| 02 Unified search | Partial | Search across five categories/menu/restaurants; serviceability and no-results tests. |
| 03 Five category destinations | Missing | All five tiles route to actual landing/availability pages; navigation test. |
| 04 Food Delivery vs Dine Out | Missing separate landing | Distinct entry and checkout contexts; journey recording. |
| 05 Dine Out detail | Partial | Full terms/validity/location/visit/redemption instructions; expired offer checks. |
| 06 Fruits catalogue | Missing product flow | Images/fixed variants/unit prices/quantity/stock; stock race test. |
| 07 Grocery hierarchy | Missing | Four subcategories and correct listings; configured fixture test. |
| 08 Vegetables catalogue | Missing | Fixed pack/bunch prices and availability; catalogue-to-order recording. |
| 09 Meat catalogue | Missing | Cuts/weight/price clarity, seller/handling/serviceability; approved content and journey evidence. |
| 10 Offer eligibility | Partial | Checkout coupons reusable, static homepage offers wrong; expired/ineligible/limit/terms tests. |
| 11 Valid Quick Picks/collections | Not satisfied | Replace fixed data; prove only available serviceable records are recommended. |
| 12 Add/quantity/badge/cart bar | Partial | Real Quick Picks Add, menu quantity controls, live total and global cart bar; UI assertions. |
| 13 Vendor cart policy | Reusable for food | Enforce one vendor client/server for products; replacement prompt and direct mixed-ID test. |
| 14 Checkout revalidation | Partial with blockers | B04/B05 and inventory/fee eligibility tests; changed-total explicit consent. |
| 15 Confirmation/payment/next steps | Partial | COD status, ID/vendor/pack snapshots and next actions; confirmation screenshot. |
| 16 Orders/statuses | Reusable for food | Isolated progression/cancellation/no-show and packing-language tests; runtime evidence. |
| 17 Vendor isolation | Existing guards; unverified end to end | Existing guarded actions plus new product/stock/redemption/report denial tests. |
| 18 Admin controls | Partial | Categories/capabilities/campaigns/merchandising plus existing gates/vendors; permission tests. |
| 19 Designed edge states | Partial | Product stock/location/category errors and server boundaries; failure recordings. |
| 20 Small/large phones | Unverified; small controls found | Real devices/viewport screenshots including long labels, keyboard and fixed bars. |
| 21 Desktop/tablet | Partial structural gap | Wider grids/navigation; 768/1024/1440 evidence. |
| 22 Accessibility | Partial; unverified | Contrast/target/focus/labels/keyboard/screen reader evidence. |
| 23 Analytics | Missing funnel events | Event assertions for discovery/cart/checkout/order/retention and no duplicates. |
| 24 Performance | Unverified | Representative mobile network and catalogue-size measurements, budgets and profiling. |
| 25 Payment retries/callbacks | COD idempotency partial; online deferred | B06 same-attempt and ownership tests now; signed callback/reconciliation tests before online enablement. |

### Minimum meaningful test scenarios

- Current food order with required add-ons, per-item packing, minimum basket, 15-second cancellation, acceptance, dispatch, gate-code handover and commission invoice.
- Two configurations of one menu item show distinct correct lines; reorder revalidates and prompts before replacing a cart.
- Two customers race for the last pack; one succeeds, the other receives an out-of-stock resolution; retries do not double reserve.
- Gate changes, closed/suspended vendor, inactive campus/gate and mixed-vendor IDs are refused server-side.
- Price/coupon/fee change between quote and submission requires reconfirmation; invalid coupons never silently disappear.
- Cancellation and reservation release happen once; abandoned attempts do not leak inventory/coupon capacity.
- Vendor A cannot read/change Vendor B stock/orders/claims/statements; customer A cannot obtain customer B's order with an idempotency key.
- Dine Out expired/used codes fail; redemption and retries cannot double apply an offer.
- Network failure and service-worker update retain cart, communicate stale order state and never report an offline authoritative checkout success.
- Guest/client payload redaction, real authenticator proof, session expiry and revocation checks cover B01–B03.

## 16. Remaining product/operations decisions

These are unresolved **configuration or policy choices**. They do not block delivery of this analysis; the dependent feature must not assume commercial terms during implementation.

| Decision | Recommendation / clarification needed | Gates |
| --- | --- | --- |
| Launch campus/gates and pilot sellers | Use actual configured campus/gate data; identify approved pilot coverage, not an assumed list from marketing. | Activation, search and ETA |
| Fees/tax/commission per vertical | Keep next-release COD direction; agree enabled customer fees, per-item vs vendor-wide packing, tax treatment and commission basis. | T07,T21,T38 |
| Coupon funding and stacking | Recommend one applied delivery coupon initially; explicitly define platform/vendor funding and any delivery-fee promotion interactions. | T07,T33 |
| Retail substitutions | Restaurant substitution flow exists. Recommend opt-in fixed-pack replacements at equal/lower payable cost initially, otherwise remove/cancel; confirm consent and quality expectations. | Produce/retail fulfilment |
| Dine Out redemption method | Recommend short-lived claim code/QR verified in vendor portal; define limits, bill capture, funding, dispute and expiry rules. | T23 |
| Closed vendors in discovery | Recommend available-only homepage, separate closed browse filter, ordering disabled; current feed behaviour differs. | Homepage curation |
| Notifications | Define whether inbox is needed, allowed marketing/reminder topics and consent/frequency limits. | T35 |
| Android scope | Confirm whether PWA installation satisfies launch or native Android is separately required. | T42 |
| Image storage | Select supported GridFS capacity plan or object storage/CDN and migration; current docs/code disagree. | Catalogue growth |
| Recovery/load targets | Set RPO/RTO, expected peak traffic and API latency budgets with operations. | Release validation |
| Visual references | Obtain separately mentioned designs for exact visual comparison; structure is assessable from the PDF now. | Final visual sign-off |

## 17. Verification record

| Check | Result | Scope |
| --- | --- | --- |
| `npm.cmd run typecheck` | Pass, exit 0 | Next route type generation and TypeScript |
| `npm.cmd test -- tests/unit` | Pass, exit 0; 27 files / 291 tests | Existing unit suite only |
| `npm.cmd run lint` | Fail, exit 1; 41 errors / 1 warning | Existing repository baseline |
| ESLint JSON evidence | Captured and reduced to file/line/rule messages | `eslint-baseline.json`; excludes source copies |
| Integration suite | Not run | Requires isolated seeded DB; local config imports `.env.local` |
| Production build | Not run | This audit does not establish build/deployment health |
| Browser/mobile/a11y/Lighthouse | Not run | Release QA still required |
| Gateway callbacks/refunds | Not applicable to current COD release; not run | Later online-payment phase |

PowerShell blocked `npm.ps1` under the host execution policy, so checks used the standard `npm.cmd` entry point. No execution policy or permissions were changed.

## 18. Source evidence index

Paths are relative to the workspace root. Line numbers refer to the inspected baseline and may move after edits.

| Reference | Evidence |
| --- | --- |
| `src/app/page.tsx:74` | Static food marketing/campus/canteen claim; surrounding hero includes fixed delivery estimate. |
| `src/components/student/campus-hero-banner.tsx:31` | Three category definitions. |
| `src/components/student/campus-hero-banner.tsx:74` | Fixed Quick Picks and mismatched image assignment. |
| `src/components/student/campus-hero-banner.tsx:186` | Static free-delivery and ETA claims. |
| `src/components/student/campus-hero-banner.tsx:295` | Static new/regular-user offer claims. |
| `src/components/student/campus-restaurant-feed.tsx:224` | Category filters are restaurant heuristics. |
| `src/components/student/bottom-nav.tsx:30` | Four-tab navigation and hard-coded campus fallback. |
| `src/components/student/student-shell.tsx:35` | Student-wide narrow max-width. |
| `src/components/student/zone-picker.tsx` | Gate picker and permanent notification dot. |
| `src/components/student/campus-search-bar.tsx:164` | Filter icon opens search suggestions. |
| `src/server/services/catalog.ts:57` | Full Restaurant type used as public list item. |
| `src/app/(student)/c/[campusSlug]/page.tsx` | Records passed into client feed; gate-before-browsing state. |
| `src/app/(student)/layout.tsx:18` | Quick-unlock object passed to client shell. |
| `src/server/actions/session.ts:663` | Biometric input uses credential ID, then equality/sign-in. |
| `src/server/auth/quick-unlock.ts:49` | Purpose/user signing without server token expiry. |
| `src/server/auth/session.ts:188` | Quick token resolution independent from normal session rows. |
| `src/server/services/orders.ts:98` | Arbitrary menu-ID lookup without selected-vendor comparison. |
| `src/server/services/orders.ts:176` | Vendor-wide packing and campus delivery fees passed as zero. |
| `src/server/services/orders.ts:254` | Global idempotency-key lookup. |
| `src/server/services/orders.ts:274` | Coupon invalidity falls through if validation fails. |
| `src/server/services/orders.ts:338` | Zone existence check without served/active check in this path. |
| `src/server/actions/student.ts` | Curfew check and placement schema; no accepted quote reference. |
| `src/components/student/cart-view.tsx:107` | Presentation join by item rather than configured line. |
| `src/components/student/menu-item-row.tsx` | Existing Add/customisation/conflict UI. |
| `src/components/student/cart-bar.tsx` | Count-only cart bar. |
| `src/app/(student)/orders/page.tsx` | Order history; no customer reorder action. |
| `src/app/(student)/c/[campusSlug]/r/[restaurantSlug]/page.tsx` | Existing menu, dine-in coupons and static safety claim. |
| `src/server/services/coupons.ts:130` | Separate dine-in coupon display; delivery eligibility excludes those coupons. |
| `src/types/restaurant.ts`, `src/types/order.ts`, `src/types/finance.ts` | Restaurant/menu model, COD order snapshots, vendor commission direction and coupon channels. |
| `src/server/db/collections.ts` | Existing collections; no generic products/variants/inventory/redemptions. |
| `src/server/db/indexes.ts` | Existing unique/order/customer/vendor query indexes. |
| `src/server/actions/vendor.ts` | Vendor session scoping and guarded order mutations. |
| `src/components/admin/admin-shell.tsx`, `src/components/vendor/vendor-shell.tsx` | Existing role-console navigation. |
| `src/components/admin/zone-editor.tsx`, `src/components/admin/campus-map.tsx` | Real gate/geofence configuration; Leaflet maps already exist. |
| `src/server/services/settlement.ts`, `src/server/services/analytics.ts` | COD commission invoices and earnings analytics. |
| `src/server/services/menu-image-storage.ts` | GridFS upload and disk fallback. |
| `src/app/layout.tsx`, `src/app/sitemap.ts` | Food metadata/home canonical and static campus/vendor sitemap. |
| `public/sw.js`, `src/components/shared/pwa.tsx`, `src/hooks/use-poll.ts` | Existing PWA/network-only order reads/polling connection states. |
| `.github/workflows/verify.yml`, `vitest.config.mts` | Non-blocking lint; local env import and integration DB risk. |
| `docs/DECISIONS.md`, `docs/PHASE_PLAN.md`, `docs/DEPLOYMENT.md` | Older scope/payment/storage/auth decisions and backup caveat. |

## 19. How to use the artifact

Use the blockers in section 6 for the first stabilisation work; the backlog and rollout gates for planning; sections 4–5 and 10 for design; section 8 for data/API work; and section 15 for QA sign-off. Keep requirements status separate from executed evidence. A visually complete homepage is one part of the marketplace; each activated category must complete inventory, fulfilment, support and financial handling before taking orders.

Companion files: `TREFOOD_IMPLEMENTATION_AUDIT.html` for browser reading/printing, `implementation-backlog.csv` for planning tools, `pdf-acceptance-matrix.csv` for QA, `verification.json` for check results, `eslint-baseline.json` for existing lint findings, and `handoff-source.txt` for the extracted PDF reference.
