import { GoogleGenAI, Type } from "@google/genai";
import { JapaneseSentence } from "../types";

const ai = null; // Removed top-level instantiation

export async function translateAndTokenize(text: string): Promise<JapaneseSentence> {
  // 1. Check local DB first (Hybrid approach)
  try {
    const localResponse = await fetch(`/api/scenarios/search?q=${encodeURIComponent(text)}`);
    if (localResponse.ok) {
      const localData = await localResponse.json();
      return {
        original: localData.korean,
        translated: localData.japanese,
        tokens: localData.tokens
      };
    }
  } catch (err) {
    console.warn("Local DB search failed, falling back to server-side translation:", err);
  }

  // 2. Call Server-side Translation
  const customApiKey = localStorage.getItem('custom_gemini_api_key');
  
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, customApiKey })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Translation failed");
  }

  const result = await response.json();
  return {
    original: text,
    translated: result.translated,
    tokens: result.tokens
  };
}
