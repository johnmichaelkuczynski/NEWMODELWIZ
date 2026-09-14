import { streamProviderText } from "./aiProviders";

export interface FictionComparisonResult {
  winnerDocument: 'A' | 'B';
  documentAScore: number;
  documentBScore: number;
  comparisonAnalysis: string;
  detailedBreakdown: string;
}

const FICTION_COMPARISON_PROMPT = `FICTION COMPARISON: WHICH CONSTRUCTS A MORE COMPELLING FICTIONAL REALITY?

You are comparing two fiction samples to determine which one creates a more immersive, coherent, and thematically meaningful fictional world.

FICTION-SPECIFIC EVALUATION CRITERIA:
- WORLD COHERENCE: Internal consistency and believability of the fictional world
- EMOTIONAL PLAUSIBILITY: Authenticity of characters' emotions and psychological responses  
- THEMATIC DEPTH: Meaningful exploration of underlying themes and ideas
- NARRATIVE STRUCTURE: Effectiveness of story construction, pacing, and flow
- PROSE CONTROL: Mastery of language, style, and writing craft

CRITICAL: Evaluate each fiction sample on its own merits using these fiction-appropriate criteria.

RESPONSE FORMAT (NO MARKDOWN):

WINNER: Document [A or B]
DOCUMENT A SCORE: [Score]/100
DOCUMENT B SCORE: [Score]/100

DOCUMENT A ANALYSIS:
WORLD SUMMARY: [Describe the fictional world and its key elements]

FICTION ASSESSMENT: [Evaluate world coherence, emotional plausibility, thematic depth, narrative structure, and prose control]

DOCUMENT B ANALYSIS:
WORLD SUMMARY: [Describe the fictional world and its key elements]

FICTION ASSESSMENT: [Evaluate world coherence, emotional plausibility, thematic depth, narrative structure, and prose control]

COMPARATIVE VERDICT: [Explain which fiction sample creates a more compelling fictional reality and why, based on the five fiction criteria]

Document A:`;

function parseFictionComparisonResponse(response: string): FictionComparisonResult {
  const cleanResponse = response
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}/g, '')
    .trim();

  console.log('Parsing fiction comparison response. Response length:', cleanResponse.length);
  console.log('First 1000 chars:', cleanResponse.substring(0, 1000));

  // Extract winner
  const winnerMatch = cleanResponse.match(/WINNER:\s*Document\s*([AB])/i);
  let winnerDocument: 'A' | 'B' = 'A';
  
  if (winnerMatch) {
    winnerDocument = winnerMatch[1].toUpperCase() as 'A' | 'B';
  }

  // Extract scores with multiple patterns
  const scorePatterns = [
    /DOCUMENT A SCORE:\s*(\d+)(?:\/100)?/i,
    /Document A.*?(\d+)\/100/i,
    /A.*?Score.*?(\d+)/i
  ];
  
  const scorePatternsB = [
    /DOCUMENT B SCORE:\s*(\d+)(?:\/100)?/i,
    /Document B.*?(\d+)\/100/i,
    /B.*?Score.*?(\d+)/i
  ];

  let documentAScore = 80;
  let documentBScore = 80;

  // Try to extract Document A score
  for (const pattern of scorePatterns) {
    const match = cleanResponse.match(pattern);
    if (match) {
      documentAScore = Math.min(Math.max(parseInt(match[1]), 0), 100);
      break;
    }
  }

  // Try to extract Document B score
  for (const pattern of scorePatternsB) {
    const match = cleanResponse.match(pattern);
    if (match) {
      documentBScore = Math.min(Math.max(parseInt(match[1]), 0), 100);
      break;
    }
  }

  console.log(`Parsed fiction comparison - Document A: ${documentAScore} Document B: ${documentBScore}`);
  console.log(`Winner determined: ${winnerDocument}`);

  const hasAnalysis = cleanResponse.includes('DOCUMENT A ANALYSIS') && cleanResponse.includes('DOCUMENT B ANALYSIS');
  const hasBreakdown = cleanResponse.includes('COMPARATIVE VERDICT') || cleanResponse.includes('FICTION ASSESSMENT');

  return {
    winnerDocument,
    documentAScore,
    documentBScore,
    comparisonAnalysis: cleanResponse,
    detailedBreakdown: cleanResponse
  };
}

async function makeFictionComparisonRequest(
  prompt: string,
  provider: string,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  const systemMessage = "You are an expert fiction critic and literary analyst specializing in comparative analysis.";
  
  return streamProviderText(provider, [
    { role: "system", content: systemMessage },
    { role: "user", content: prompt },
  ], onChunk || (() => undefined), { temperature: 0.2, maxTokens: 4000 });
  /* switch (provider) {
    case 'openai':
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const openaiResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      });
      return openaiResponse.choices[0].message.content || "";

    case 'anthropic':
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const anthropicResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2
      });
      return anthropicResponse.content[0].type === 'text' ? anthropicResponse.content[0].text : "";

    case 'perplexity':
      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: prompt }
          ],
          temperature: 0.2
        })
      });
      
      if (!perplexityResponse.ok) {
        throw new Error(`Perplexity API error: ${perplexityResponse.status}`);
      }
      
      const perplexityData: any = await perplexityResponse.json();
      return perplexityData.choices?.[0]?.message?.content || "";

    case 'deepseek':
      const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: prompt }
          ],
          temperature: 0.2
        })
      });
      
      if (!deepseekResponse.ok) {
        throw new Error(`DeepSeek API error: ${deepseekResponse.status}`);
      }
      
      const deepseekData: any = await deepseekResponse.json();
      return deepseekData.choices?.[0]?.message?.content || "";

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  } */
}

export async function performFictionComparison(
  documentA: string, 
  documentB: string, 
  provider: string,
  onChunk?: (chunk: string) => void,
): Promise<FictionComparisonResult> {
  const prompt = FICTION_COMPARISON_PROMPT + "\n\n" + documentA + "\n\nDocument B:\n\n" + documentB;
  
  console.log(`COMPARING FICTION WITH ${provider.toUpperCase()}`);
  
  try {
    const response = await makeFictionComparisonRequest(prompt, provider, onChunk);
    const result = parseFictionComparisonResponse(response);
    
    console.log('Parsed fiction comparison result:', {
      winnerDocument: result.winnerDocument,
      documentAScore: result.documentAScore,
      documentBScore: result.documentBScore,
      hasAnalysis: result.comparisonAnalysis.length > 500,
      hasBreakdown: result.detailedBreakdown.length > 500
    });
    
    return result;
    
  } catch (error) {
    console.error(`Fiction comparison failed with ${provider}:`, error);
    throw new Error(`Fiction comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}