import fetch from 'node-fetch';

interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
  pagemap?: {
    metatags?: Array<{
      [key: string]: string;
    }>;
  };
}

interface GoogleSearchResponse {
  items?: GoogleSearchResult[];
  error?: {
    code: number;
    message: string;
    errors: Array<{
      message: string;
      domain: string;
      reason: string;
    }>;
  };
}

/**
 * Search Google using the Custom Search JSON API
 * @param query The search query
 * @param numResults Number of results to return (max 10)
 * @returns Array of search results
 */
export async function searchGoogle(query: string, numResults = 5): Promise<GoogleSearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !searchEngineId) {
    throw new Error('Google API Key or Search Engine ID not configured');
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=${numResults}`;
    
    const response = await fetch(url);
    const data = await response.json() as GoogleSearchResponse;
    
    if (data.error) {
      console.error('Google API error:', data.error);
      throw new Error(`Google API error: ${data.error.message}`);
    }
    
    return data.items || [];
  } catch (error) {
    console.error('Error searching Google:', error);
    throw error;
  }
}

/**
 * Extract and fetch the content from a URL
 * @param url The URL to fetch content from
 * @returns Extracted text content or null if extraction failed
 */
export async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // Very basic content extraction - this could be improved with a proper HTML parser
    // This is a simplified approach that removes HTML tags and extracts text
    const textContent = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    
    // Limit the content length to prevent overwhelming the AI
    return textContent.slice(0, 5000);
  } catch (error) {
    console.error(`Error fetching URL ${url}:`, error);
    return null;
  }
}