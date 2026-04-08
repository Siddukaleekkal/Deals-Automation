# 🚀 Setup Guide — WhatsApp → Zoho CRM Deal Agent

Follow these steps in order. Each one takes about 5–10 minutes.

---

## STEP 1 — Get Your Zoho API Credentials

1. Go to **https://api-console.zoho.com**
2. Click **"Add Client"** → choose **"Self Client"**
3. Click **"CREATE"** — you'll see your **Client ID** and **Client Secret**. Copy both.
4. Click the **"Generate Code"** tab
5. In the **Scope** field, paste this exactly:
   ```
   ZohoCRM.modules.deals.CREATE,ZohoCRM.modules.deals.READ
   ```
6. Set **Time Duration** to `10 minutes`, add any description, click **"CREATE"**
7. Copy the **Authorization Code** shown (you have 10 minutes to use it!)
8. Now open a new browser tab and paste this URL (replace the placeholders):
   ```
   https://accounts.zoho.com/oauth/v2/token?code=YOUR_AUTH_CODE&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&redirect_uri=https://zoho.com&grant_type=authorization_code
   ```
9. Hit Enter — you'll get back JSON. Copy the **refresh_token** value.

✅ You now have: Client ID, Client Secret, Refresh Token

---

## STEP 2 — Get Your Anthropic API Key

1. Go to **https://console.anthropic.com/settings/keys**
2. Click **"Create Key"**
3. Name it "Deal Agent", copy the key (starts with `sk-ant-...`)

✅ You now have: Anthropic API Key

---

## STEP 3 — Set Up Twilio WhatsApp Sandbox

1. Sign up at **https://twilio.com** (free trial)
2. Go to **Messaging → Try it out → Send a WhatsApp message**
3. Follow the instructions to join the sandbox (you'll text a code to a Twilio number)
4. Note your **sandbox WhatsApp number** (e.g. +1 415 523 8886)
5. You'll set the webhook URL in Step 5

---

## STEP 4 — Deploy to Railway (free hosting)

1. Go to **https://railway.app** and sign up with GitHub
2. Click **"New Project" → "Deploy from GitHub repo"**
3. Upload this project folder to a new GitHub repo first:
   - Go to https://github.com/new
   - Create a repo called `deal-agent`
   - Upload all files from this folder
4. Back in Railway, select your repo
5. Click **"Variables"** tab and add these one by one:
   ```
   ANTHROPIC_API_KEY = (your key from Step 2)
   ZOHO_CLIENT_ID = (from Step 1)
   ZOHO_CLIENT_SECRET = (from Step 1)
   ZOHO_REFRESH_TOKEN = (from Step 1)
   ```
6. Railway will deploy automatically. Click **"Settings" → "Domains"** to get your URL
   (looks like: `https://deal-agent-production.up.railway.app`)

✅ Your server is live!

---

## STEP 5 — Connect Twilio to Your Server

1. Go back to Twilio → **Messaging → Try it out → WhatsApp**
2. In the **"When a message comes in"** field, paste:
   ```
   https://YOUR-RAILWAY-URL.up.railway.app/whatsapp
   ```
3. Make sure the method is set to **HTTP POST**
4. Click **Save**

✅ Everything is connected!

---

## STEP 6 — Test It!

Send this WhatsApp message to your Twilio sandbox number:
```
John Smith, $500, 555-867-5309, john@email.com, 123 Oak St, house wash, Friday 10am, Quoted1
```

You should get a confirmation back AND see the deal in Zoho CRM within seconds! 🎉

---

## 💡 Tips for Texting Deals

You can text in natural language — be as casual as you want:

✅ **Works great:**
- "Mike at 555-1234, $400, 88 Pine Ave, soft wash Tuesday morning"
- "Sarah Johnson quote $750 full house + driveway, 321 Elm, closing next week → Closed Won"
- "New lead: Bob's Car Wash, commercial job $2000, contact bob@biz.com"

The AI will figure out the fields automatically!

---

## 🛟 Troubleshooting

| Problem | Fix |
|---|---|
| "Failed to get Zoho token" | Regenerate your refresh token (Step 1) — they expire |
| Deal created but fields missing | Zoho custom field names may differ — contact support |
| Twilio not receiving messages | Make sure you're texting the sandbox number AND joined the sandbox |
| Railway deploy fails | Check that all 4 environment variables are set |
