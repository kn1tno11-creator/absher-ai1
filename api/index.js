import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import fetch from 'node-fetch';

dotenv.config();
dotenv.config({ path: '.env.local' });

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- Configuration ---
const ELEVENLABS_API_KEY = "sk_ca4eb8ba5d7ed2243d59fc8270bca7c59f02b34b1503a269"; // Moved from frontend
const ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

// --- Routes ---

// TTS Endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API Error:', errorText);
      return res.status(response.status).json({ error: 'TTS Failed', details: errorText });
    }

    // Pipe the audio stream directly to the response
    response.body.pipe(res);

  } catch (error) {
    console.error('Server TTS Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.post('/api/chat', async (req, res) => {
  try {
    // Your existing code...
    const { transcript, context, lang } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
        console.error("GEMINI_API_KEY is missing in environment variables.");
        return res.status(500).json({ error: "Server configuration error: Missing API Key" });
    }

    const systemPrompt = `
      You are the "Absher Smart Assistant", the most advanced government AI in the world.
      
      **CORE OBJECTIVE**: Help the user complete services (Passport Renewal, Violation Payment) efficiently.
      **SUPERPOWER**: You have "Stateful Memory". You remember every detail the user says.

      --- CONTEXT ---
      User: Hadeel Al-shehri (ID: 1056789012).
      Current View: ${context.view}.
      Language: ${lang}.
      Current Form Data: ${JSON.stringify(context.formData)}.
      History: ${JSON.stringify(req.body.history || [])}.
      User Input: "${transcript}"

      --- SERVICE FLOWS (THE BRAIN) ---

      **1. PASSPORT RENEWAL FLOW**
      - **Trigger**: User mentions "passport", "renew", "travel".
      - **Required Slots**:
        1. [City]: (e.g., Riyadh, Jeddah).
        2. [Duration]: (5 or 10).
      - **Logic**:
        - IF (User says "Renew"): Action = NAVIGATE_PASSPORT.
        - IF (City is MISSING): Ask "Which city would you like to pick up your passport from?"
        - IF (Duration is MISSING): Ask "Do you want to renew for 5 years (300 SAR) or 10 years (600 SAR)?"
        - IF (City AND Duration are PRESENT): 
          - Action = FILL_FORM (with values).
          - Response = "Perfect. I have filled the form: 10 years, pickup in Riyadh. Total is 600 SAR. Shall I confirm?"

      **2. VIOLATION PAYMENT FLOW**
      - **Trigger**: User mentions "fine", "violation", "ticket".
      - **Required Slots**:
        1. [Confirmation]: (yes/pay).
      - **Logic**:
        - IF (User says "Pay fines"): Action = NAVIGATE_VIOLATIONS.
        - IF (User is on VIOLATIONS view AND says "Pay" or "Yes"):
          - Action = CONFIRM_ACTION.
          - Response = "Processing payment of 150 SAR... Done. You are now debt-free."

      --- GLOBAL RULES ---
      1. **ONE-SHOT FILLING**: If user says "Renew passport for 10 years in Riyadh", FILL ALL SLOTS immediately and ask for confirmation.
      2. **AUTO-NAVIGATION**: If user wants a service, GO THERE first (NAVIGATE_X).
      3. **PROACTIVE WARNINGS**: If user asks "Status" or "Updates", check mock data. If unpaid fines exist, warn them.

      --- OUTPUT FORMAT (JSON) ---
      {
        "action": "NAVIGATE_X" | "FILL_FORM" | "CONFIRM_ACTION" | "GENERAL_QUERY",
        "targetView": "PASSPORT" | "VIOLATIONS" | "DASHBOARD" | "LOGIN",
        "formData": { "city": "Riyadh", "duration": "10" }, // ONLY return fields you extracted NOW or from HISTORY
        "speechResponse": "Natural, helpful voice response.",
        "uiMessage": "Short screen message"
      }
    `;

    // --- Attempt 1: Gemini ---
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    // Log the raw response for debugging
    console.log("Raw Gemini response:", JSON.stringify(response, null, 2));
     let responseText = '';
    if (typeof response.text === 'function') {
        responseText = response.text();
    } else if (typeof response.text === 'string') {
        responseText = response.text;
    } else if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
        responseText = response.candidates[0].content.parts[0].text;
    } else {
        console.error("Unexpected Gemini response structure:", JSON.stringify(response, null, 2));
        throw new Error("Failed to extract text from Gemini response");
    }

    const result = JSON.parse(responseText);
    res.json(result);
    
    // Rest of your code...
  } catch (error) {
    console.error("Server Chat Error", error);
    // Include more details in your error response
    res.status(500).json({ 
        action: "ERROR",
        speechResponse: "Sorry, I encountered an error processing your request.",
        uiMessage: "Error processing request",
        debugError: error.message,
        debugStack: error.stack
    });
  }
});
// Chat Endpoint


// Export the app for Vercel
export default app;

// Only start the server if running locally (not on Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
