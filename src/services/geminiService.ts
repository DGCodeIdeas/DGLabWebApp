import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

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

export async function convertChapterToVNScript(title: string, source: string, modelId: string = "gemini-3-flash-preview") {
  const ai = getAI();
  
  const systemInstruction = `
    You are an expert Visual Novel script writer.
    Your task is to convert the provided story or novel excerpt into a professional visual novel script using Ren'Py syntax.
    
    Common syntax:
    scene [background name]
    show [character name] [emotion]
    [character name] "Dialogue text here"
    "Narration text here"
    
    Maintain the tone and narrative structure of the source material while optimizing for a visual novel format.
    Provide only the script code, no markdown formatting unless requested.
  `;

  const prompt = `
    Project Title: ${title}
    
    Source Material:
    ${source}
    
    Please convert this chapter into a detailed visual novel script.
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
    console.error("Gemini VN conversion failed:", error);
    throw error;
  }
}

export async function generateVisualNovelScript(prompt: string, context: string, unfiltered: boolean = false) {
  const ai = getAI();
  
  const systemInstruction = `
    You are an expert Visual Novel script writer.
    Your task is to help the user write or expand their visual novel script using Ren'Py syntax.
    
    Common syntax:
    scene [background name]
    show [character name] [emotion]
    [character name] "Dialogue text here"
    "Narration text here"
    
    Provide only the script code, no markdown formatting unless requested.
  `;

  const fullPrompt = `
    Current Script Context:
    ${context}
    
    User Request:
    ${prompt}
  `;

  const safetySettings = unfiltered ? [
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  ] : undefined;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: fullPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
        safetySettings,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Gemini VN generation failed:", error);
    throw error;
  }
}
