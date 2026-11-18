# Bhala launch kit

This kit gives you Bhala as a real website on Netlify, with **30 days free, then R29 a month through PayFast**. When an apprentice pays, the app unlocks by itself.

```
public/
  index.html          home page: what Bhala is, how it works, features, pricing, FAQ
  colleges.html       for colleges and employers, with the quote request form
  pricing.html        plans and what's included
  faq.html            all questions and answers
  contact.html        contact form and email
  privacy.html        privacy notice (POPIA)
  terms.html          terms of use and subscription
  thank-you.html      shown after someone sends a form
  404.html            shown for a wrong link
  styles.css site.js  the look of the website and the phone menu
  img/                app screenshots, printout pictures, sharing image (og.png)
  sitemap.xml robots.txt   help Google find the pages
  app/                the Bhala app (installs on phones, works offline)
  admin/              your page to see who pays and the money in
netlify/
  functions/          4 small server pieces: subscribe, PayFast notify (ITN), status, admin
  lib/                PayFast signing and checks, subscriber storage
netlify.toml          tells Netlify where everything is
package.json          one helper Netlify installs for you (@netlify/blobs)
```

Logbooks stay on each apprentice's phone. The server only keeps a random app number, first name, email and payment dates.

---

## Step 1: put the kit on GitHub (about 10 minutes, no coding)

Netlify's drag-and-drop deploy **won't run the payment parts**. Connect GitHub instead (free).

Do this on a laptop or desktop, not a phone.

1. Sign in at github.com and click **New repository**. Name it `bhala` and choose **Private**.
2. On the new repo page, click **uploading an existing file**.
3. Unzip this kit on your computer. Drag **everything inside the `bhala-kit` folder** into the page, then click **Commit changes**.

## Step 2: connect it to Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub**, then pick `bhala`.
2. Leave the build settings as they are (netlify.toml fills them in). Click **Deploy**.
3. You get a link like `https://bhala-xyz.netlify.app`. In **Domain management** you can rename it, for example to `bhala-logbook.netlify.app` if that name is free, or add your own domain.

## Step 3: add your settings

In Netlify: **Site configuration → Environment variables → Add a variable**.

| Name | While testing | When live |
| --- | --- | --- |
| `PAYFAST_SANDBOX` | `true` | `false` |
| `PAYFAST_MERCHANT_ID` | `10004002` (PayFast's published sandbox test account) | from PayFast: Settings → Developer settings |
| `PAYFAST_MERCHANT_KEY` | `q1cd2rdny4a53` | from PayFast: Settings → Developer settings |
| `PAYFAST_PASSPHRASE` | `payfast` | the passphrase (salt passphrase) you set in PayFast |
| `PRICE` | `29` | `29` |
| `ADMIN_KEY` | a long password you both keep (12+ characters) | same |

Optional: `ITEM_NAME` (text on the PayFast page), `DAYS_PER_PAYMENT` (default 35: one month plus a few days' grace), `PAYFAST_ACCEPTED_AMOUNTS` (old prices, comma-separated, if you ever change the price so existing subscribers still unlock).

`PAYFAST_EXTRA_IPS` (optional): the app only accepts payment notices from PayFast's published server addresses (built in, checked 18 Nov 2026). If PayFast announces new addresses, add them here comma-separated, for example `1.2.3.0/28`, and deploy.

**After changing settings:** go to **Deploys → Trigger deploy → Deploy site**, so the functions pick them up.

## Step 3b: switch on the website forms (2 minutes)

The quote form (colleges page) and the contact form use **Netlify Forms**, which are free.

1. In Netlify, open **Forms** and click **Enable form detection**.
2. Trigger a deploy (**Deploys → Trigger deploy**) so Netlify finds the two forms: `college-quote` and `contact`.
3. Get an email for every message: **Site configuration → Notifications → Emails and webhooks → Form submission notifications → Add notification → Email notification**, then enter `bhala.logbook@gmail.com`.
4. Test it: send yourself a message from `your-site/contact.html`. It appears under **Forms** and in your Gmail.

## Step 4: test with fake money

1. Open `your-site/app/` on your phone. Tap **Start my own logbook** and add a name.
2. Tap the badge at the top (it says *30 days free*) → **Subscribe with PayFast**, then enter any email.
3. On PayFast's **sandbox** page, pay with the test wallet. Nothing real is charged.
4. You come back to Bhala and see **Bhala Pro is on** within a minute.
5. Open `your-site/admin/` and enter your `ADMIN_KEY`. You see 1 paying apprentice and R29.00.

If it says *Payment not confirmed yet*: in Netlify open **Logs → Functions → payfast-itn**. The log says which check failed (signature, source, amount or PayFast's confirmation). A wrong passphrase is the usual cause.

## Step 5: go live

1. Wait for PayFast to verify your account (about 2 business days after your documents).
2. In PayFast, set a **passphrase** (Settings → Developer settings; PayFast may call it a salt passphrase).
3. Put your live merchant ID, key and passphrase into Netlify, and set `PAYFAST_SANDBOX` to `false`. Then trigger a deploy.
4. Subscribe yourself with a real card for R29. Check the admin page, then cancel your own subscription in the PayFast dashboard.

## Step 6: before you share the link

- The contact email on the website and privacy page is already set to bhala.logbook@gmail.com. When you register a company, add its name to the privacy page.
- The app shows **Africa Skills George Tech** as the default college. Keep it only once the college has agreed. Otherwise search `var COLLEGE` in `public/app/index.html` and change it. Apprentices can also type their own college.
- If you change the price, change it in three places: `PRICE` in Netlify, `var CFG = {price:29` in `public/app/index.html`, and the R29 on the landing page.

## Sharing with apprentices

Send the link. Tell them to open it in **Chrome (Android)** or **Safari (iPhone)**, then put it on the home screen:
- **Android:** ⋮ menu → *Install app* or *Add to Home screen*
- **iPhone:** Share → *Add to Home Screen*

On the Me screen they can tap **Add reminder** to get a daily reminder in their phone's calendar.

## Everyday running

- **Who paid:** `your-site/admin/` shows paying apprentices, money collected, money after PayFast fees, and a split calculator. PayFast's dashboard is the official record for your books.
- **Cancelling:** apprentices use the link in PayFast's email, or you cancel for them in the PayFast dashboard. They keep access until the end of the month they paid for.
- **New phone:** the apprentice restores their backup file (Me → Restore). Their subscription comes with it.
- **Updating the app:** edit files on GitHub and Netlify redeploys automatically. Each deploy uses 15 of the free plan's 300 monthly credits, so group your changes. After changing app files, change `VERSION` in `public/app/sw.js` (for example to `bhala-v2`) so phones fetch the update.

## Good to know

- New days can be logged for today and up to 7 days back (change `backDays` in `var CFG` in `public/app/index.html`). This keeps apprentices logging, and paying, all through their training instead of filling in months at once. Old entries can always be edited.
- The free trial starts when an apprentice starts their own logbook. Clearing the app's data resets the trial, but it also deletes their logbook, so few will do it.
- The app checks the paid state when it opens (every 2 days at most). It keeps working offline until the paid-up date.
- `public/app/pdf-lib.min.js` is the open-source PDF maker (MIT licence, see `pdf-lib-LICENSE.md`).
