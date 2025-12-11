import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
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

// Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { transcript, context, lang } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
        console.error("GEMINI_API_KEY is missing in environment variables.");
        return res.status(500).json({ error: "Server configuration error: Missing API Key" });
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    const systemPrompt = `
      You are the intelligent Voice Assistant for 'Absher', the Saudi government services portal.
      Your persona: Professional, polite, efficient, and secure.
      
      Current User: Mohammed Al-Saud (ID: 1056789012).
      Current View: ${context.view}.
      User Language: ${lang}.
      Mock Data: ${JSON.stringify(context.formData)}. 

      User Input: "${transcript}"

      Instructions:
      1. Analyze the user's intent. The user might speak English or Arabic (transliterated or script).
      2. Determine the Action: 
         - LOGIN (if in LOGIN view and user wants to enter)
         - NAVIGATE_[VIEW_NAME]
         - FILL_FORM (extract entities like city, duration, numbers)
         - CONFIRM_ACTION
         - GENERAL_QUERY
      3. Generate a response in the SAME LANGUAGE as the User Input.
         - If user speaks Arabic, reply in Arabic.
         - If user speaks English, reply in English.
      4. Return strict JSON.

      JSON Schema:
      {
        "action": "string",
        "targetView": "string (optional)",
        "formData": "object (optional key-value pairs e.g. {city: 'Riyadh'})",
        "speechResponse": "string",
        "uiMessage": "string (shorter version for display)"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    
    const result = JSON.parse(response.text());
    res.json(result);

  } catch (error) {
    console.error("Server Chat Error", error);
    res.status(500).json({ 
        action: "ERROR",
        speechResponse: "Sorry, I encountered an error processing your request.",
        uiMessage: "Error processing request"
    });
  }
});

// Export the app for Vercel
export default app;

// Only start the server if running locally (not on Vercel)
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}
