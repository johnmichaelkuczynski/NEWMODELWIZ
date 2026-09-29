import { EnhancementSuggestion, GoogleSearchResult } from '@/lib/types';

/**
 * Get enhancement suggestions from AI for a text
 */
export async function getEnhancementSuggestions(text: string, provider: string): Promise<EnhancementSuggestion[]> {
  try {
    const response = await fetch('/api/get-enhancement-suggestions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, provider }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get enhancement suggestions');
    }

    const data = await response.json();
    return data.suggestions || [];
  } catch (error) {
    console.error('Error getting enhancement suggestions:', error);
    throw error;
  }
}

/**
 * Search Google for information related to a query
 */
export async function searchGoogle(query: string, numResults = 5): Promise<GoogleSearchResult[]> {
  try {
    const response = await fetch('/api/search-google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, numResults }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to search Google');
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error searching Google:', error);
    throw error;
  }
}

/**
 * Fetch content from a URL
 */
export async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const response = await fetch('/api/fetch-url-content', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch URL content');
    }

    const data = await response.json();
    return data.content || null;
  } catch (error) {
    console.error('Error fetching URL content:', error);
    return null;
  }
}