import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import fetch from 'node-fetch';
import { cleanAIResponse } from '../lib/textUtils';

// Initialize the API clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface FictionAssessmentResult {
  worldCoherence: number;
  emotionalPlausibility: number;
  thematicDepth: number;
  narrativeStructure: number;
  proseControl: number;
  overallFictionScore: number;
  detailedAssessment: string;
}

const FICTION_ASSESSMENT_PROMPT = `RESPOND WITH ONLY THE 6 LINES BELOW, REPLACE [number] WITH ACTUAL SCORES:

WORLD COHERENCE: [number]/100
EMOTIONAL PLAUSIBILITY: [number]/100
THEMATIC DEPTH: [number]/100
NARRATIVE STRUCTURE: [number]/100
PROSE CONTROL: [number]/100
OVERALL FICTION SCORE: [number]/100

DO NOT ADD ANY OTHER TEXT. NO EXPLANATIONS. NO ANALYSIS. ONLY THE 6 SCORE LINES.

Text to score:`;

function parseFictionAssessmentResponse(response: string): FictionAssessmentResult {
  // Use the enhanced cleanAIResponse function for aggressive markdown removal
  const cleanResponse = response
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/>\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const extractScore = (section: string): number => {
    const patterns = [
      // Handle ranges like "Score: 90-94"
      new RegExp(`${section}[:\\s]*Score:\\s*(\\d+)-(\\d+)`, 'i'),
      // Handle direct scores like "WORLD COHERENCE: 85/100"
      new RegExp(`${section}:\\s*(\\d+)/100`, 'i'),
      // Handle direct scores without /100
      new RegExp(`${section}:\\s*(\\d+)`, 'i'),
      // Handle "Score: X" format
      new RegExp(`Score:\\s*(\\d+)(?:/100)?`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = cleanResponse.match(pattern);
      if (match) {
        if (match[2]) {
          // Range format - take the middle value
          const low = parseInt(match[1]);
          const high = parseInt(match[2]);
          const score = Math.round((low + high) / 2);
          return Math.min(Math.max(score, 0), 100);
        } else {
          const score = parseInt(match[1]);
          return Math.min(Math.max(score, 0), 100);
        }
      }
    }
    
    // If score extraction fails, return a neutral score
    console.log(`Warning: Could not extract ${section} score from response`);
    return 75;
  };

  const worldCoherence = extractScore('WORLD COHERENCE');
  const emotionalPlausibility = extractScore('EMOTIONAL PLAUSIBILITY');
  const thematicDepth = extractScore('THEMATIC DEPTH');
  const narrativeStructure = extractScore('NARRATIVE STRUCTURE');
  const proseControl = extractScore('PROSE CONTROL');
  let overallFictionScore = extractScore('OVERALL FICTION SCORE');

  console.log('Parsed fiction scores:', {
    worldCoherence,
    emotionalPlausibility,
    thematicDepth,
    narrativeStructure,
    proseControl,
    overallFictionScore
  });

  // Consistency check for fiction scores
  const averageDimensionScore = Math.round((worldCoherence + emotionalPlausibility + thematicDepth + narrativeStructure + proseControl) / 5);
  
  if (overallFictionScore < averageDimensionScore - 10) {
    console.log(`Inconsistent fiction overall score detected: ${overallFictionScore} vs average dimensions: ${averageDimensionScore}. Using average.`);
    overallFictionScore = averageDimensionScore;
  }

  return {
    worldCoherence,
    emotionalPlausibility,
    thematicDepth,
    narrativeStructure,
    proseControl,
    overallFictionScore,
    detailedAssessment: cleanResponse
  };
}

async function makeOpenAIFictionRequest(prompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You MUST output ONLY numerical scores in the exact format requested. DO NOT write prose, essays, or analysis. Output ONLY: SECTION NAME: [number]/100" },
      { role: "user", content: prompt }
    ],
    temperature: 0.1
  });
  
  return response.choices[0].message.content || "";
}

async function makeAnthropicFictionRequest(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2
  });
  
  return response.content[0].type === 'text' ? response.content[0].text : "";
}

async function makePerplexityFictionRequest(prompt: string): Promise<string> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "You are an expert fiction critic and literary analyst." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });
  
  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }
  
  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function makeDeepSeekFictionRequest(prompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are an expert fiction critic and literary analyst." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });
  
  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }
  
  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function performFictionAssessment(text: string, provider: string): Promise<FictionAssessmentResult> {
  const prompt = FICTION_ASSESSMENT_PROMPT + "\n\n" + text;
  
  console.log(`Starting fiction assessment with ${provider} for text of length: ${text.length}`);
  
  try {
    let response: string;
    
    switch (provider) {
      case 'openai':
        response = await makeOpenAIFictionRequest(prompt);
        break;
      case 'anthropic':
        response = await makeAnthropicFictionRequest(prompt);
        break;
      case 'perplexity':
        response = await makePerplexityFictionRequest(prompt);
        break;
      case 'deepseek':
        response = await makeDeepSeekFictionRequest(prompt);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
    
    const result = parseFictionAssessmentResponse(response);
    console.log(`Fiction assessment complete - Overall score: ${result.overallFictionScore}/100`);
    return result;
    
  } catch (error) {
    console.error(`Fiction assessment failed with ${provider}:`, error);
    throw new Error(`Fiction assessment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}