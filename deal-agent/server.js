import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// ─── Zoho OAuth Token Management ────────────────────────────────────────────
let zohoAccessToken = null;
let tokenExpiry = 0;

async function getZohoAccessToken() {
  if (zohoAccessToken && Date.now() < tokenExpiry) return zohoAccessToken;

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const res = await fetch(`https://accounts.zoho.com/oauth/v2/token?${params}`, {
    method: "POST",
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("Failed to get Zoho token: " + JSON.stringify(data));

  zohoAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return zohoAccessToken;
}

// ─── Claude: Parse WhatsApp message into deal fields ────────────────────────
async function parseDealFromMessage(message) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: `You are a data extraction assistant for a power washing business. 
Extract deal information from a casual text message and return ONLY valid JSON.
No explanation, no markdown, just raw JSON.

Fields to extract:
- Deal_Name (required - use customer name or a descriptor)
- Amount (number only, no $ sign)
- Phone (phone number)
- Email (email address)
- Job_Date_and_Time (date/time as string)
- Address (full address)
- Service (type of service e.g. "House Washing", "Driveway Cleaning")
- Note (any extra notes)
- Stage (default to "Quoted1" if not mentioned)
- Invoice_Total (number only, if mentioned separately from Amount)

If a field is not mentioned, omit it from the JSON.
Example output: {"Deal_Name":"John Smith","Amount":500,"Phone":"555-1234","Address":"123 Main St","Service":"House Washing","Stage":"Quoted1"}`,
      messages: [{ role: "user", content: message }],
    }),
  });

  const data = await response.json();
  
  // Log full response for debugging
  console.log("Anthropic response status:", response.status);
  console.log("Anthropic response:", JSON.stringify(data));

  if (data.error) throw new Error("Anthropic API error: " + data.error.message);
  if (!data.content || !data.content[0]) throw new Error("Anthropic returned empty response: " + JSON.stringify(data));
  
  const text = data.content[0].text.trim();
  console.log("Parsed text:", text);
  
  // Strip markdown code fences if present
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ─── Create Deal in Zoho CRM ─────────────────────────────────────────────────
async function createZohoDeal(dealData) {
  const token = await getZohoAccessToken();

  // Map our fields to Zoho CRM API field names
  const zohoData = {
    Deal_Name: dealData.Deal_Name,
    Pipeline: "Power Washing Jobs",
    Stage: dealData.Stage || "Quoted1",
  };

  if (dealData.Amount) zohoData.Amount = dealData.Amount;
  if (dealData.Phone) zohoData.Phone = dealData.Phone;
  if (dealData.Email) zohoData.Email = dealData.Email;
  if (dealData.Address) zohoData.Address = dealData.Address;
  if (dealData.Service) zohoData.Service = dealData.Service;
  if (dealData.Note) zohoData.Note = dealData.Note;
  if (dealData.Job_Date_and_Time) zohoData.Job_Date_and_Time = dealData.Job_Date_and_Time;
  if (dealData.Invoice_Total) zohoData.Invoice_Total = dealData.Invoice_Total;

  const res = await fetch("https://www.zohoapis.com/crm/v3/Deals", {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: [zohoData] }),
  });

  const result = await res.json();
  if (result.data && result.data[0].status === "success") {
    return { success: true, id: result.data[0].details.id };
  } else {
    throw new Error(JSON.stringify(result));
  }
}

// ─── WhatsApp Webhook (Twilio) ───────────────────────────────────────────────
app.post("/whatsapp", async (req, res) => {
  const incomingMsg = req.body.Body;
  const from = req.body.From;

  console.log(`📱 Message from ${from}: ${incomingMsg}`);

  let replyText;
  try {
    const dealData = await parseDealFromMessage(incomingMsg);
    const result = await createZohoDeal(dealData);

    replyText = `✅ Deal created!\n\n` +
      `📋 *${dealData.Deal_Name}*\n` +
      (dealData.Amount ? `💰 $${dealData.Amount}\n` : "") +
      (dealData.Address ? `📍 ${dealData.Address}\n` : "") +
      (dealData.Service ? `🔧 ${dealData.Service}\n` : "") +
      (dealData.Job_Date_and_Time ? `📅 ${dealData.Job_Date_and_Time}\n` : "") +
      `🏷️ Stage: ${dealData.Stage || "Quoted1"}\n\n` +
      `Zoho Deal ID: ${result.id}`;
  } catch (err) {
    console.error("Error:", err.message);
    replyText = `❌ Sorry, I couldn't create the deal. Error: ${err.message}\n\nPlease try again or check your message format.`;
  }

  // Respond via Twilio TwiML
  res.set("Content-Type", "text/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${replyText}</Message>
</Response>`);
});

// ─── Web Chat API (for testing without WhatsApp) ─────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "No message provided" });

  try {
    const dealData = await parseDealFromMessage(message);
    const result = await createZohoDeal(dealData);

    res.json({
      success: true,
      deal: dealData,
      zohoId: result.id,
      message: `✅ Deal "${dealData.Deal_Name}" created in Zoho CRM!`,
    });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
