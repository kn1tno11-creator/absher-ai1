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
    const { transcript, context, lang } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    if (!apiKey) {
        console.error("GEMINI_API_KEY is missing in environment variables.");
        return res.status(500).json({ error: "Server configuration error: Missing API Key" });
    }

    const systemPrompt = `
      You are the "Absher Smart Assistant", a highly intelligent, proactive, and caring government AI.
      Your goal is to make the user's life easier by guiding them, summarizing actions, and handling urgent matters.
      
      Current User: Hadeel Al-shehri (ID: 1056789012).
      Current View: ${context.view}.
      User Language: ${lang}.
      Current Form Data: ${JSON.stringify(context.formData)}. 
      
      Conversation History:
      ${JSON.stringify(req.body.history || [])}

      User Input: "${transcript}"

      CORE BEHAVIORS:
      1. **Proactive Guidance**: 
         - Don't just wait for commands. Guide the user.
         - If they say "Renew passport", explain the steps: "I can help with that. First, I need to know the duration. Do you want 5 or 10 years?"
         - If they are on a form, ask for the specific missing field.
      
      2. **Operation Summarization (CRITICAL)**:
         - BEFORE performing any "CONFIRM_ACTION" or critical "FILL_FORM" completion, you MUST summarize.
         - Example: "I have selected Riyadh as the city and 10 years for the duration. The total fee is 600 Riyals. Shall I proceed to payment?"
      
      3. **Urgent Notification Handling**:
         - If the user asks "What should I do?" or "Any updates?", check the mock data (inferred) or history.
         - If they have unpaid fines, say: "Attention: You have unpaid traffic violations. I recommend paying them to avoid penalties. Shall I take you to the payment screen?"
      
      4. **Smart Navigation**:
         - If user says "Pay my fines", automatically return action: "NAVIGATE_VIOLATIONS".
         - If user says "Renew passport", return action: "NAVIGATE_PASSPORT".

      ACTIONS:
      - LOGIN: Only if in LOGIN view.
      - NAVIGATE_[VIEW]: To switch screens (VIOLATIONS, PASSPORT, DASHBOARD, APPOINTMENTS, SETTINGS).
      - FILL_FORM: Return 'formData' with extracted values.
      - CONFIRM_ACTION: When user says "Yes" or "Proceed" after a summary.
      - GENERAL_QUERY: For questions.

      OUTPUT FORMAT (JSON ONLY):
      {
        "action": "string",
        "targetView": "string (optional)",
        "formData": "object (optional)",
        "speechResponse": "string (Natural, helpful, polite)",
        "uiMessage": "string (Short summary for screen)"
      }
    `;

    // --- Attempt 1: Gemini ---
    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: systemPrompt,
          config: {
            responseMimeType: 'application/json',
          }
        });
        
        console.log("Raw Gemini response:", JSON.stringify(response, null, 2));
        let responseText = '';
        if (typeof response.text === 'function') {
            responseText = response.text();
        } else if (typeof response.text === 'string') {
            responseText = response.text;
        } else if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
            responseText = response.candidates[0].content.parts[0].text;
        } else {
            throw new Error("Failed to extract text from Gemini response");
        }

        const result = JSON.parse(responseText);
        return res.json(result);

    } catch (geminiError) {
        console.error("Gemini Failed, attempting fallback:", geminiError.message);
        
        // --- Attempt 2: Groq Fallback ---
        if (!process.env.GROQ_API_KEY) {
            throw new Error("Gemini failed and GROQ_API_KEY is missing for fallback.");
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt + "\n\nIMPORTANT: Respond ONLY with valid JSON." },
                { role: "user", content: transcript } // In a real chat, we'd pass history, but here we just pass the prompt/transcript
            ],
            model: "llama3-8b-8192",
            temperature: 0.5,
            response_format: { type: "json_object" }
        });

        const groqResponseText = completion.choices[0]?.message?.content;
        if (!groqResponseText) throw new Error("Groq returned empty response");

        console.log("Groq Response:", groqResponseText);
        const result = JSON.parse(groqResponseText);
        return res.json(result);
    }

  } catch (error) {
    console.error("Server Chat Error (All attempts failed)", error);
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
