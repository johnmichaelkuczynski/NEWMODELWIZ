import fetch from 'node-fetch';

interface ZhiQueryResponse {
  results?: Array<{
    excerpt: string;
    citation: {
      author: string;
      work: string;
      chunkIndex: number;
    };
    relevance: number;
    tokens: number;
  }>;
  quotes?: Array<{
    text: string;
    citation: {
      author: string;
      work: string;
      chunkIndex: number;
    };
    relevance: number;
    tokens: number;
  }>;
  meta?: {
    resultsReturned: number;
    limitApplied: number;
    queryProcessed: string;
    filters: any;
    timestamp: number;
  };
  error?: string;
}

export async function queryZhiKnowledgeBase(
  queryText: string,
  maxPassages: number = 5,
  author?: string
): Promise<{ content: string; type: 'quotes' | 'excerpts' } | null> {
  const zhiPrivateKey = process.env.ZHI_PRIVATE_KEY;
  
  if (!zhiPrivateKey) {
    console.warn('ZHI_PRIVATE_KEY not configured - skipping external knowledge query');
    return null;
  }

  try {
    const requestBody = {
      query: queryText,
      author: author || 'John-Michael Kuczynski',
      limit: maxPassages,
      includeQuotes: true
    };
    
    console.log('🔵 MAXINTEL → AnalyticPhilosophy.net Zhi API');
    console.log('   URL: https://analyticphilosophy.net/zhi/query');
    console.log('   Query:', requestBody.query);
    console.log('   Author filter:', requestBody.author);
    console.log('   Limit:', requestBody.limit);
    console.log('   Include Quotes:', requestBody.includeQuotes);
    
    const response = await fetch('https://analyticphilosophy.net/zhi/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${zhiPrivateKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      console.error(`Zhi API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Zhi API error details: ${errorText}`);
      return null;
    }

    const data = await response.json() as ZhiQueryResponse;
    
    // Prioritize actual quotes over excerpts
    if (data.quotes && data.quotes.length > 0) {
      console.log(`✓ Retrieved ${data.quotes.length} VERBATIM QUOTES from Zhi knowledge base`);
      
      const formattedQuotes = data.quotes
        .map((quote, i) => 
          `[${i + 1}] "${quote.text}"\n   — ${quote.citation.author}, ${quote.citation.work}`
        )
        .join('\n\n');
      
      return {
        content: formattedQuotes,
        type: 'quotes'
      };
    }
    
    // Fall back to excerpts if no quotes available
    if (data.results && data.results.length > 0) {
      console.log(`✓ Retrieved ${data.results.length} excerpts from Zhi knowledge base (no verbatim quotes found)`);
      
      const formattedExcerpts = data.results
        .map((result, i) => 
          `[${i + 1}] ${result.excerpt}\n   — ${result.citation.author}, ${result.citation.work}`
        )
        .join('\n\n');
      
      return {
        content: formattedExcerpts,
        type: 'excerpts'
      };
    }
    
    console.log('Zhi API returned no quotes or results');
    return null;
  } catch (error) {
    console.error('Error querying Zhi knowledge base:', error);
    return null;
  }
}
