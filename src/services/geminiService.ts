import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in the environment.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function generateMangaScript(title: string, source: string, modelId: string = "gemini-3-flash-preview") {
  const ai = getAI();
  
  const systemInstruction = `
    You are an expert manga script writer. 
    Your task is to convert the provided story or novel excerpt into a professional manga script format.
    
    Format each page clearly:
    [PAGE X]
    PANEL Y: [Visual description for the artist]
    DIALOGUE (Character Name): "Line of dialogue"
    SFX: [Sound effect description]
    
    Maintain the tone and narrative structure of the source material while optimizing for visual storytelling.
  `;

  const prompt = `
    Project Title: ${title}
    
    Source Material:
    ${source}
    
    Please generate a detailed manga script for the first few scenes.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini generation failed:", error);
    throw error;
  }
}
