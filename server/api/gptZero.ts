import { DocumentInput } from "@/lib/types";
import { AIDetectionResult } from "@/lib/types";

/**
 * Check if a text is AI-generated using GPTZero API
 */
export async function checkForAI(document: DocumentInput): Promise<AIDetectionResult> {
  const apiKey = process.env.GPTZERO_API_KEY || "";
  
  if (!apiKey) {
    throw new Error("GPTZero API key not found");
  }

  try {
    const response = await fetch("https://api.gptzero.me/v2/predict/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Api-Key": apiKey
      },
      body: JSON.stringify({
        document: document.content,
        // Optional parameters
        truncation: true
      })
    });

    if (!response.ok) {
      throw new Error(`GPTZero API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract probability from GPTZero response and ensure valid range
    const rawProb = data.documents[0]?.completely_generated_prob || 0;
    // Clamp probability to valid range [0, 1] and convert to percentage
    const clampedProb = Math.max(0, Math.min(1, rawProb));
    const probability = Math.round(clampedProb * 100);
    const isAI = probability >= 50;
    
    console.log(`GPTZero API raw response:`, rawProb, `-> clamped:`, clampedProb, `-> percentage:`, probability);

    return {
      isAI,
      probability
    };
  } catch (error) {
    console.error("Error checking for AI:", error);
    // Return a default result if the API call fails
    return {
      isAI: false,
      probability: 0
    };
  }
}
