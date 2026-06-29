import { searchGoogle, fetchUrlContent } from './googleSearch';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

interface ResearchInstruction {
  query: string;          // The research instructions from the user
  searchTerms?: string[]; // Extracted search terms for Google
  questions?: string[];   // Questions to ask the LLM about the research
  contextNotes?: string;  // Notes about how to interpret the results
}

interface ResearchResults {
  searchResults: any[];
  contentExtracts: Record<string, string>;
  llmInsights: {
    openai?: string;
    anthropic?: string;
    perplexity?: string;
  };
}

/**
 * Extract search terms from complex research instructions
 */
async function extractSearchTerms(instructions: string): Promise<string[]> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a research assistant helping to extract search terms from complex research instructions. Given the instructions, identify 2-3 concise, specific search queries that would yield the most relevant results from Google. Return only the search terms as a JSON array of strings."
        },
        {
          role: "user",
          content: instructions
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    return result.search_terms || [];
  } catch (error) {
    console.error("Error extracting search terms:", error);
    
    // Fallback: basic keyword extraction if OpenAI fails
    const keywords = instructions
      .replace(/find content about/i, '')
      .replace(/ask openai|ask claude|ask perplexity|discuss|explain/gi, '')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !['about', 'what', 'when', 'where', 'which', 'there', 'their', 'that'].includes(word.toLowerCase()))
      .slice(0, 5);
      
    return [keywords.join(' ')];
  }
}

/**
 * Conducts advanced research based on complex instructions
 * @param instructions Research instructions
 * @returns Research results including search results and LLM insights
 */
export async function conductAdvancedResearch(instructions: string): Promise<ResearchResults> {
  // Extract search terms for Google
  const searchTerms = await extractSearchTerms(instructions);
  
  // Conduct searches with each term
  const allSearchResults: any[] = [];
  const contentExtracts: Record<string, string> = {};
  
  for (const term of searchTerms) {
    const results = await searchGoogle(term);
    allSearchResults.push(...results);
    
    // Fetch content from the most relevant results (limit to top 3)
    for (const result of results.slice(0, 3)) {
      const content = await fetchUrlContent(result.link);
      if (content) {
        contentExtracts[result.link] = content;
      }
    }
  }
  
  // Remove duplicates from search results
  const uniqueResults = allSearchResults.filter((result, index, self) => 
    index === self.findIndex(r => r.link === result.link)
  );
  
  // Get insights from available LLMs about the research topic
  const llmInsights: {
    openai?: string;
    anthropic?: string;
    perplexity?: string;
  } = {};
  
  // Get OpenAI insights if available
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a research assistant providing insights on the following research topic. Provide a concise, substantive response that directly addresses the research question."
          },
          {
            role: "user",
            content: instructions
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });
      
      llmInsights.openai = response.choices[0].message.content;
    } catch (error) {
      console.error("Error getting OpenAI insights:", error);
    }
  }
  
  // Get Anthropic insights if available
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      // the newest Anthropic model is "claude-sonnet-4-5" which was released February 24, 2025
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 500,
        messages: [
          { 
            role: "user", 
            content: `I'd like your insights on the following research topic. Please provide a direct, substantive response: ${instructions}` 
          }
        ],
      });
      
      llmInsights.anthropic = response.content[0].text;
    } catch (error) {
      console.error("Error getting Anthropic insights:", error);
    }
  }
  
  return {
    searchResults: uniqueResults,
    contentExtracts,
    llmInsights
  };
}