import { GoogleGenerativeAI } from "@google/generative-ai";
import { TechnicalSpecs } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const aiSpecsService = {
  async suggestSpecs(productName: string, model: string, category: string): Promise<Partial<TechnicalSpecs> | null> {
    try {
      const modelAI = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        You are a mobile and electronics expert in Yemen.
        Extract technical specifications for the following product:
        Name: ${productName}
        Model: ${model}
        Category: ${category}
        
        Provide the response in JSON format only with these keys if applicable:
        ram (string, e.g., "8GB"),
        storage (string, e.g., "128GB"),
        battery (string, e.g., "5000mAh"),
        screenStatus (string, e.g., "AMOLED 6.7"),
        deviceStatus (string: 'new' | 'used'),
        color (string),
        modelCode (string).
        
        If it's an accessory (e.g., Headset), include relevant specs like "Bluetooth Version", "Battery Life".
        Return ONLY the JSON.
      `;

      const result = await modelAI.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean potential markdown code blocks
      const cleanJson = text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (error) {
      console.error("AI Spec extraction failed:", error);
      return null;
    }
  }
};
