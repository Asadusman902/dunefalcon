# Dune Falcon Dubai — Booking Site

Booking landing page + admin dashboard. Every booking is:

1. saved to **Supabase** and shown in the **admin dashboard** (`/admin`)
2. emailed to you (and a confirmation to the customer) via **Resend**
3. sent to your **WhatsApp** via Meta's **WhatsApp Cloud API**

Stack: Next.js 14 · Supabase · Resend · WhatsApp Cloud API · Hostinger (Node.js hosting).

---

## 1. Supabase (5 min)

1. Go to supabase.com → **New project** (region: closest to Dubai, e.g. Mumbai or Frankfurt).
2. Open **SQL Editor** → paste all of `supabase/schema.sql` → **Run**.
3. Go to **Project Settings → API** and copy:
   - Project URL → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret)

## 2. Resend email (5 min)

1. Sign up at resend.com → **API Keys** → create a key → `RESEND_API_KEY`.
2. To start, leave `RESEND_FROM` as `onboarding@resend.dev`. Resend only delivers this to the email you signed up with, so sign up with **dunefalcondubai@gmail.com**.
3. When you have a domain: **Domains → Add domain**, add the DNS records, then set
   `RESEND_FROM=Dune Falcon <bookings@yourdomain.com>`. Customers then get confirmation emails too.

## 3. WhatsApp alerts (30 min + Meta approval, usually 1–2 days)

1. developers.facebook.com → **My Apps → Create app → Business** → add **WhatsApp**.
2. **WhatsApp → API Setup**:
   - Add a phone number for sending (a new SIM or virtual number; it cannot be the number already on your WhatsApp Business app). Meta's free test number works for trying it out.
   - Copy **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
   - Add your personal WhatsApp (`+971502341729`) as a recipient → `NOTIFY_WHATSAPP=971502341729`.
3. **Permanent token**: Business Settings → **System users** → add an admin system user → **Generate token** for your app with `whatsapp_business_messaging` → `WHATSAPP_TOKEN`.
4. **Message template** (WhatsApp Manager → Message templates → Create):
   - Category: **Utility** · Name: `new_booking` · Language: **English**
   - Body (copy exactly, 7 variables):
     ```
     New booking {{1}}
     Guest: {{2}}
     Package: {{3}}
     When: {{4}}
     Guests: {{5}}
     Total: {{6}}
     Customer WhatsApp: {{7}}
     ```
   - Submit. Once approved, set `WHATSAPP_TEMPLATE=new_booking`.

Until WhatsApp is set up, bookings still save and email normally. The site just skips the WhatsApp alert.

## 4. Deploy on Hostinger (15 min)

This is a Node.js app, not a static site. Do **not** upload it to `public_html` / File Manager. You need a Hostinger plan with **Node.js web apps** (Business or Cloud) or a **VPS**. Single and Premium web hosting cannot run it.

### Option A: Business / Cloud plan (recommended)

1. hPanel → **Websites** → **Add website** → **Node.js Apps**.
2. Choose **Import Git repository**, connect GitHub and pick the `dunefalcon` repo, branch `main`.
   (Or choose **Upload files** and upload a zip of this folder without `node_modules` and `.next`.)
3. Build settings (Hostinger usually detects Next.js and fills these in):
   - Framework: **Next.js**
   - Node version: **20.x** (18.18 or newer works)
   - Install: `npm install` · Build: `npm run build` · Start: `npm start`
4. **Environment variables**: add every variable from `.env.example` with real values. `ADMIN_SESSION_SECRET` must be 24+ random characters.
5. **Deploy**. Pick the client domain (e.g. `dunefalcondubai.com`) for the app when hPanel asks. If the domain is registered at Hostinger, DNS is set up for you, and SSL is issued automatically.
6. Every push to `main` redeploys the site. After changing environment variables, redeploy from the app dashboard.

### Option B: Hostinger VPS

```bash
# on the VPS (Ubuntu), once
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git
sudo npm install -g pm2
git clone https://github.com/chaudhryasadusman0987-spec/dunefalcon.git && cd dunefalcon
cp .env.example .env.local     # fill in real values
npm install && npm run build
pm2 start npm --name dunefalcon -- start   # serves on port 3000
pm2 save && pm2 startup
```

Then point Nginx at the app (`proxy_pass http://127.0.0.1:3000;`) for `dunefalcondubai.com`, add an **A** record for `@` and `www` to the VPS IP in hPanel DNS, and add SSL with `sudo certbot --nginx`.

To update later: `git pull && npm install && npm run build && pm2 restart dunefalcon`.

**Email:** if the client uses Hostinger email on the same domain, leave the **MX** records alone.

## 5. Use it

- Booking page: `https://your-site/`
- Admin: `https://your-site/admin` (password = `ADMIN_PASSWORD`)
  - **Leads**: new bookings appear automatically (refreshes every 20 s, shows a pop-up for new ones). Change status, WhatsApp the guest, add Instagram/WhatsApp enquiries by hand.
  - **Schedule & timing**: pickup slots, capacity, open days, cut-off hours, closed dates.
  - **Packages & pricing**: prices, child price, per person or per car, inclusions, show/hide.
  - **Add-ons & business**: add-on prices, WhatsApp, email, DTCM licence.
- Put the site link in your Instagram bio instead of the Appointy link.

## Test a booking

1. Make a booking on the live site with your own number and email.
2. Check: lead in `/admin` · email in your inbox · WhatsApp alert.
3. If something didn't arrive: open the app logs (hPanel → your Node.js app → **Logs**, or `pm2 logs dunefalcon` on a VPS) and search `[notify]`. Each channel logs `sent`, `skipped` (missing env var) or `failed` with the reason.

## Run locally

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev                  # http://localhost:3000
```

## Notes

- All times are Dubai time (UTC+4), whatever country the customer books from.
- The server re-checks price, closed dates, cut-off and seat capacity, so totals can't be changed from the browser.
- The hidden "company" field silently drops spam bots.
