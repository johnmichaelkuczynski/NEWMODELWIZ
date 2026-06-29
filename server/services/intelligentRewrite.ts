import { executeFourPhaseProtocol } from './fourPhaseProtocol';
import fetch from 'node-fetch';

type LLMProvider = 'openai' | 'anthropic' | 'perplexity' | 'deepseek' | 'grok';

interface ZhiQueryResponse {
  success: boolean;
  passages?: Array<{
    text: string;
    source: string;
    relevance: number;
  }>;
  error?: string;
}

async function queryZhiKnowledgeBase(text: string): Promise<string | null> {
  const { queryZhiKnowledgeBase: queryZhi } = await import('./zhiApi');
  const zhiResult = await queryZhi(text, 5);
  
  if (zhiResult) {
    const label = zhiResult.type === 'quotes' ? 'VERBATIM QUOTES' : 'EXCERPTS/SUMMARIES';
    return `\n\nEXTERNAL KNOWLEDGE FROM ZHI DATABASE (${label}):\n${zhiResult.content}\n`;
  }
  
  return null;
}

interface IntelligentRewriteRequest {
  text: string;
  customInstructions?: string;
  styleSample?: string;
  provider: LLMProvider;
  useExternalKnowledge?: boolean;
}

interface IntelligentRewriteResult {
  originalText: string;
  rewrittenText: string;
  originalScore: number;
  rewrittenScore: number;
  provider: string;
  instructions: string;
  rewriteReport: string;
}

// Map ZHI names to actual provider names
function mapZhiToProvider(zhiName: string): string {
  const mapping: Record<string, string> = {
    'zhi1': 'openai',
    'zhi2': 'anthropic', 
    'zhi3': 'deepseek',
    'zhi4': 'perplexity',
    'zhi5': 'grok'
  };
  return mapping[zhiName] || zhiName;
}

// Default high-quality style samples
const DEFAULT_STYLE_SAMPLES = {
  philosophical: `One cannot have the concept of a red object without having the concept of an extended object. But the word "red" doesn't contain the word "extended." In general, our concepts are interconnected in ways in which the corresponding words are not interconnected. This is not an accidental fact about the English language or about any other language: it is inherent in what a language is that the cognitive abilities corresponding to a person's abilities to use words cannot possibly be reflected in semantic relations holding among those words.`,
  
  technical: `Sense-perceptions do not have to be deciphered if their contents are to be uploaded, the reason being that they are presentations, not representations. Linguistic expressions do have to be deciphered if their contents are to be uploaded, the reason being that they are representations, not presentations. It is viciously regressive to suppose that information-bearing mental entities are categorically in the nature of representations, as opposed to presentations, and it is therefore incoherent to suppose that thought is mediated by expressions or, therefore, by linguistic entities.`,
  
  analytic: `It is shown (i) that causation exists, since we couldn't even ask whether causation existed unless it did; (ii) that any given case of causation is a case of persistence; and (iii) that spatiotemporal relations supervene on causal relations. (ii) is subject to the qualification that we tend not to become aware of instances of causation as such except when two different causal lines---i.e. two different cases of persistence---intersect, resulting in a breakdown of some other case of persistence, this being why we tend to regard instances of causation as fundamentally disruptive, as opposed to preservative in nature.`
};

// Detect if text is a fragment that needs completion
function isFragment(text: string): boolean {
  const trimmed = text.trim();
  
  // Check for obvious incompleteness markers
  const hasIncompleteEnding = trimmed.endsWith('...') || 
                               trimmed.endsWith(',') ||
                               trimmed.endsWith('and') ||
                               trimmed.endsWith('or') ||
                               trimmed.endsWith('but');
  
  // Check if it's very short (likely a fragment)
  const wordCount = trimmed.split(/\s+/).length;
  const isVeryShort = wordCount < 150;
  
  // Check if it lacks conclusion markers
  const hasConclusion = /therefore|thus|in conclusion|consequently|as a result|this shows that/i.test(trimmed);
  
  return hasIncompleteEnding || (isVeryShort && !hasConclusion);
}

// Detect if text is fiction
function isFiction(text: string): boolean {
  // Simple heuristic: fiction has dialogue, narrative, or story structure
  const hasDialogue = /["'].*?["']/.test(text) && /said|asked|replied|thought/i.test(text);
  const hasNarrative = /he |she |they |character|protagonist|story/i.test(text);
  const lacksAcademic = !/therefore|thus|however|moreover|furthermore|consequently/i.test(text);
  
  return (hasDialogue || hasNarrative) && lacksAcademic;
}

export async function performIntelligentRewrite(request: IntelligentRewriteRequest): Promise<IntelligentRewriteResult> {
  const { text, customInstructions, styleSample, provider: rawProvider, useExternalKnowledge } = request;
  const provider = mapZhiToProvider(rawProvider) as LLMProvider;
  
  console.log(`Starting intelligent rewrite with ${provider}${useExternalKnowledge ? ' (with external knowledge)' : ''}`);
  
  // Step 1: Query external knowledge base if enabled
  let externalKnowledge: string | null = null;
  if (useExternalKnowledge) {
    externalKnowledge = await queryZhiKnowledgeBase(text);
  }
  
  // Step 2: Get baseline score using 4-phase protocol
  console.log('Step 2: Evaluating original text...');
  const originalEvaluation = await executeFourPhaseProtocol(text, provider);
  const originalScore = originalEvaluation.overallScore;
  
  console.log(`Original score: ${originalScore}/100`);
  
  // Step 3: Determine style sample to use
  const effectiveStyleSample = styleSample || DEFAULT_STYLE_SAMPLES.philosophical;
  
  // Step 3: Detect if fragment and needs completion (ALWAYS complete unless user explicitly says not to)
  const isTextFragment = isFragment(text);
  const isTextFiction = isFiction(text);
  const shouldComplete = !customInstructions?.toLowerCase().includes('do not complete');
  
  // Step 4: Create COMPLETION + STYLE-MATCHING prompt
  const basePrompt = `YOUR MISSION: Transform the INPUT TEXT into a COMPLETE, SELF-CONTAINED, MULTI-PAGE ${isTextFiction ? 'STORY' : 'ESSAY'} that matches the STYLE of the TARGET SAMPLES.

TARGET STYLE SAMPLES (MATCH THIS WRITING STYLE):
${effectiveStyleSample}
${externalKnowledge || ''}

🎯 CRITICAL SUCCESS CRITERIA:

1. LENGTH & COMPLETENESS:
   - INPUT is 1 paragraph → OUTPUT must be 3-5+ pages (multi-page complete ${isTextFiction ? 'story' : 'essay'})
   - Every claim must be FULLY DEVELOPED with concrete examples
   - Result must be SELF-CONTAINED and COMPLETE (intro, body, conclusion if essay; full story arc if fiction)

2. CONCRETE EXAMPLES REQUIRED:
   - Add 5-10+ CONCRETE EXAMPLES throughout to illustrate every major point
   - Examples must be SPECIFIC (not "consider a database" but "consider PostgreSQL's MVCC implementation where...")
   - Examples prove you understand the concepts deeply

3. STYLE MATCHING (from TARGET SAMPLES):
   - Match the SHARP, DIRECT sentence structure (never bloated academic prose)
   - Match the TECHNICAL PRECISION and logical connectives (therefore, because, since)
   - Match the BOLD, EDGY tone if present
   - Match the COMPRESSION (dense meaning per sentence)

4. EXPANSION STRATEGY:
   - Take each claim in INPUT and expand it into 2-3 paragraphs with:
     * Detailed explanation
     * 2-3 concrete examples
     * Logical support (because/therefore chains)
     * Counterarguments and responses if relevant
   - Add NEW sections that logically follow from INPUT's claims
   - Develop implications and consequences

5. FORBIDDEN:
   - Generic academic filler ("It is important to note that...", "In the framework of...")
   - Vague generalizations without examples
   - Making sharp prose LESS sharp
   - Making concise prose LESS concise (you can expand CONTENT but keep SENTENCES tight)
   - Bloat that doesn't add substance

${customInstructions ? `6. CUSTOM INSTRUCTIONS FROM USER:
${customInstructions}

Apply these while maintaining the core mission: COMPLETE MULTI-PAGE OUTPUT with CONCRETE EXAMPLES in TARGET STYLE.` : ''}

INPUT TEXT (EXPAND THIS INTO COMPLETE ${isTextFiction ? 'STORY' : 'ESSAY'}):
${text}

OUTPUT REQUIREMENTS:
- Output ONLY the complete ${isTextFiction ? 'story' : 'essay'} (NO meta-commentary)
- Must be 3-5+ pages of substantive content with concrete examples
- Must be self-contained and complete
- Match TARGET STYLE precisely (sharp, direct, example-rich)
- Start immediately with the content

COMPLETE ${isTextFiction ? 'STORY' : 'ESSAY'}:`;

  let rewrittenText: string;
  try {
    // Use the same LLM call pattern as other services
    if (provider === 'openai') {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: basePrompt }],
        temperature: 0.3,
        max_tokens: 8000
      });
      
      rewrittenText = completion.choices[0]?.message?.content || '';
    } else if (provider === 'anthropic') {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      
      const completion = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 8000,
        messages: [{ role: "user", content: basePrompt }],
        temperature: 0.3
      });
      
      rewrittenText = completion.content[0]?.type === 'text' ? completion.content[0].text : '';
    } else if (provider === 'perplexity') {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: basePrompt }],
          temperature: 0.3,
          max_tokens: 8000
        })
      });
      
      const data: any = await response.json();
      rewrittenText = data.choices[0]?.message?.content || '';
    } else if (provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: basePrompt }],
          temperature: 0.3,
          max_tokens: 8000
        })
      });
      
      const data: any = await response.json();
      rewrittenText = data.choices[0]?.message?.content || '';
    } else if (provider === 'grok') {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "grok-3",
          messages: [{ role: "user", content: basePrompt }],
          temperature: 0.3,
          max_tokens: 8000
        })
      });
      
      const data: any = await response.json();
      rewrittenText = data.choices[0]?.message?.content || '';
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
    
    // Strip out AI commentary if it slipped through
    rewrittenText = rewrittenText
      .replace(/^Here's.*?:/i, '')
      .replace(/^This.*?version.*?:/i, '')
      .replace(/^The following.*?:/i, '')
      .replace(/^Below.*?:/i, '')
      .replace(/^\*\*.*?\*\*:?/gm, '')
      .replace(/^--+/gm, '')
      .replace(/^Rewritten.*?:/i, '')
      .trim();
      
  } catch (error) {
    console.error(`Error during rewrite with ${provider}:`, error);
    throw new Error(`Rewrite failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Step 5: Evaluate the rewritten text
  console.log('Step 2: Evaluating rewritten text...');
  const rewrittenEvaluation = await executeFourPhaseProtocol(rewrittenText, provider);
  const rewrittenScore = rewrittenEvaluation.overallScore;
  
  console.log(`Rewritten score: ${rewrittenScore}/100`);
  console.log(`Score improvement: ${rewrittenScore - originalScore} points`);
  
  // Step 6: Generate rewrite report
  const improvementType = rewrittenScore > originalScore ? 'improvement' : 
                         rewrittenScore < originalScore ? 'regression' : 'no change';
  
  const rewriteReport = `Intelligent Rewrite Analysis:

Original Score: ${originalScore}/100
Rewritten Score: ${rewrittenScore}/100
Change: ${rewrittenScore > originalScore ? '+' : ''}${rewrittenScore - originalScore} points (${improvementType})

Provider: ${provider}
Method: Style-matching rewrite (matches target style sample)
${shouldComplete ? `Completion: Fragment expanded to complete ${isTextFiction ? 'story' : 'essay'}` : ''}
Instructions: ${customInstructions || 'Default style-matching optimization'}

The rewrite ${improvementType === 'improvement' ? 'successfully enhanced' : 
             improvementType === 'regression' ? 'unfortunately decreased' : 'maintained'} 
the text's intelligence score through ${improvementType === 'improvement' ? 'precise style-matching and logical strengthening' : 
                                                  improvementType === 'regression' ? 'changes that may have disrupted the original flow' :
                                                  'style refinements that preserved the intellectual level'}.`;

  return {
    originalText: text,
    rewrittenText,
    originalScore,
    rewrittenScore,
    provider,
    instructions: customInstructions || 'Default style-matching optimization',
    rewriteReport
  };
}
