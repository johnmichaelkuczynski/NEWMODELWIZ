// GPT Bypass Humanizer - Complete Implementation
import { checkForAI } from '../api/gptZero';

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

interface HumanizerRequest {
  boxA: string; // AI-written text to humanize
  boxB: string; // Human-written style sample to mimic
  provider: string;
  customInstructions?: string;
  stylePresets?: string[];
}

interface HumanizerResult {
  originalText: string;
  humanizedText: string;
  originalAIScore: number; // GPTZero percentage
  humanizedAIScore: number; // GPTZero percentage  
  styleAnalysis: string;
  provider: string;
  timestamp: string;
}

interface ChunkedHumanizerRequest extends HumanizerRequest {
  selectedChunkIds?: string[];
  chunks?: TextChunk[];
}

interface TextChunk {
  id: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

// Writing samples from the specification
export const WRITING_SAMPLES = {
  "Content-Neutral": {
    "Formal and Functional Relationships": `There are two broad types of relationships: formal and functional.
Formal relationships hold between descriptions. A description is any statement that can be true or false.
Example of a formal relationship: The description that a shape is a square cannot be true unless the description that it has four equal sides is true. Therefore, a shape's being a square depends on its having four equal sides.

Functional relationships hold between events or conditions. (An event is anything that happens in time.)
Example of a functional relationship: A plant cannot grow without water. Therefore, a plant's growth depends on its receiving water.

The first type is structural, i.e., it holds between statements about features.
The second is operational, i.e., it holds between things in the world as they act or change.

Descriptions as objects of consideration
The objects of evaluation are descriptions. Something is not evaluated unless it is described, and it is not described unless it can be stated. One can notice non-descriptions — sounds, objects, movements — but in the relevant sense one evaluates descriptions of them.

Relationships not known through direct observation
Some relationships are known, not through direct observation, but through reasoning. Such relationships are structural, as opposed to observational. Examples of structural relationships are:

If A, then A or B.

All tools require some form of use.

Nothing can be both moving and perfectly still.

There are no rules without conditions.

1 obviously expresses a relationship; 2–4 do so less obviously, as their meanings are:

2*. A tool's being functional depends on its being usable.
3*. An object's being both moving and still depends on contradictory conditions, which cannot occur together.
4*. The existence of rules depends on the existence of conditions to which they apply.

Structural truth and structural understanding
Structural understanding is always understanding of relationships. Observational understanding can be either direct or indirect; the same is true of structural understanding.`,

    "Alternative Account of Explanatory Efficiency": `A continuation of the earlier case will make it clear what this means and why it matters. Why doesn't the outcome change under the given conditions? Because, says the standard account, the key factor remained in place. But, the skeptic will counter, perhaps we can discard that account; perhaps there's an alternative that fits the observations equally well. But, I would respond, even granting for argument's sake that such an alternative exists, it doesn't follow that it avoids more gaps than the one it replaces. It doesn't follow that it is comparable from a trade-off standpoint to the original—that it reduces as many issues as the old view while introducing no more new ones. In fact, the opposite often holds. Consider the alternative mentioned earlier. The cost of that account—meaning what new puzzles it creates—is vastly greater than its value—meaning what old puzzles it removes. It would be difficult to devise an account inconsistent with the conventional one that, while still matching the relevant evidence, is equally efficient in explanatory terms. You can test this for yourself. If there is reason to think even one such account exists, it is not because it has ever been produced. That reason, if it exists, must be purely theoretical. And for reasons soon to be made clear, no such purely theoretical reason can justify accepting it. But there is a further difficulty for this—or, by a similar line of thought, for any non-standard—replacement of the conventional view. It is not at all clear that, once the relevant details are considered, the replacement is even logically possible. Taken on its own, a substitute account may describe a situation that seems coherent. It may not be contradictory in the strict sense. But that alone is not enough for it to serve as a viable model of the relevant information. Think of the range of underlying principles that would have to be set aside. Setting them aside, if possible at all, would create ripple effects. Consider the various assumptions about causation, inference, and explanation that would be undermined.`
  },

  "Epistemology": {
    "Rational Belief and Underlying Structure": `When would it become rational to believe that, next time, you're more likely than not to roll this as opposed to that number—that, for example, you're especially likely to roll a 27? This belief becomes rational when, and only when, you have reason to believe that a 27-roll is favored by the structures involved in the game. And that belief, in its turn, is rational if you know that circumstances at all like the following obtain: *The dice are magnetically attracted to the 27-slot. *On any given occasion, you have an unconscious intention to roll a 27 (even though you have no conscious intention of doing this), and you're such a talented dice-thrower that, if you can roll a 27 if it is your (subconscious) intention to do so. *The 27-slot is much bigger than any of the other slots. In fact, it takes up so much space on the roulette wheel that the remaining spaces are too small for the ball to fit into them. You are rational to believe that you'll continue to roll 27s to the extent that your having thus far rolled multiple 27s in a row gives you reason to believe there to be some underlying structure favoring that outcome. And to the extent that a long run of 27-rolls doesn't give you such a reason, you are irrational to believe that you're any more (or any less) likely to roll a 27 than you are any other number. So, no matter how many consecutive 27s you roll, if you know with certainty that there is no underlying structure that would favor such an outcome, then you have no more reason to expect a 27 than you are a 5 or a 32. Put pedantically, it is only insofar as you have reason to believe in such a structure that you have reason to expect something that has the property of being a die thrown by you to have the property of landing in the 27-slot.`,

    "Knowledge vs. Awareness": `Knowledge is conceptually articulated awareness. In order for me to know that my shoes are uncomfortably tight, I need to have the concepts shoe, tight, discomfort, etc. I do not need to have these concepts—or, arguably, any concepts—to be aware of the uncomfortable tightness in my shoes. My knowledge of that truth is a conceptualization of my awareness of that state of affairs. Equivalently, there are two kinds of awareness: propositional and objectual. My visual perception of the dog in front of me is a case of objectual awareness, as is my awareness of the tightness of my shoes. My knowledge that there is a dog in front of me is a case of proposition-awareness, as is my knowledge that my shoes are uncomfortably tight. Truths, not objects, the objects of explanation. Observations are objectual awarenesses. The contents of such awarenesses must be converted into propositions if they are to be explained. This is because it is truths that are explained, and truths are true propositions.`
  },

  "Paradoxes": {
    "The Loser Paradox": `People who are the bottom of a hierarchy are far less likely to spurn that hierarchy than they are to use it against people who are trying to climb the ranks of that hierarchy. The person who never graduates from college may in some contexts claim that a college degree is worthless, but he is unlikely to act accordingly. When he comes across someone without a college degree who is trying to make something of himself, he is likely to pounce on that person, claiming he is an uncredentialed fraud. Explanation: Losers want others to share their coffin, and if that involves hyper-valuing the very people or institutions that put them in that coffin, then so be it.`,

    "The Indie Writer's Paradox": `People don't give good reviews to writers who do not already have positive reviews. Analysis: This is a veridical paradox, in the sense that it describes an actual vicious circle and does not represent a logical blunder. An independent writer is by definition one who does not have a marketing apparatus behind him, and such a writer depends on uncoerced positive reviews. But people are extremely reluctant to give good reviews to writers who are not popular already or who do not have the weight of some institution behind them. This circle can be broken by writers who mass-produce schlock, but there is no real way for other writers to break it. This is a special form of the Grass Roots Movement Paradox.`,

    "Arrow's Information Paradox": `If you don't know what it is, you don't buy it. Therefore, you don't buy information unless you know what it is. But if you know what it is, you don't need to buy it. But information is bought. Solution: The obvious solution is that information can be described without being disclosed. I can tell you that I have the so and so's phone number without giving you that number, and the circumstances may give you reason to believe me. But oftentimes it isn't until a given person discloses what he says he knows that he there is any reason to believe him to know it. There are a lot of people who make a living charging others for insights into the market, even they have no such insight, as their customers eventually find out.`
  }
};

// Style presets from specification (1-8 most important)
export const STYLE_PRESETS = {
  // Most important (1-8)
  "Mixed cadence + clause sprawl": "Alternate short and long sentences; allow some long sentences to wander with extra clauses.",
  "Asymmetric emphasis": "Over-elaborate one point; compress or skate past another.",
  "One aside": "Add a quick parenthetical or em-dash remark — factual, not jokey.",
  "Hedge twice": "Use two mild uncertainty markers (\"probably,\" \"seems,\" \"roughly,\" \"I think\").",
  "Local disfluency": "Keep one redundant or slightly awkward phrase that still makes sense.",
  "Analogy injection": "Insert a short, concrete comparison to something unrelated but illustrative.",
  "Topic snap": "Abruptly shift focus once, then return.",
  "Friction detail": "Drop in a small, seemingly unnecessary but real-world-plausible detail.",

  // Structure & Cadence
  "Compression — light (−15%)": "Cut filler; merge short clauses; keep meaning.",
  "Compression — medium (−30%)": "Trim hard; delete throat-clearing; tighten syntax.",
  "Compression — heavy (−45%)": "Sever redundancies; collapse repeats; keep core claims.",
  "DECREASE BY 50%": "REDUCE THE LENGTH BY HALF WHILE PRESERVING MEANING",
  "INCREASE BY 150%": "EXPAND THE TEXT TO 150% LONGER WITH ADDITIONAL DETAIL AND ELABORATION",
  "Mixed cadence": "Alternate 5–35-word sentences; no uniform rhythm.",
  "Clause surgery": "Reorder main/subordinate clauses in 30% of sentences.",
  "Front-load claim": "Put the main conclusion in sentence 1; support follows.",
  "Back-load claim": "Delay the conclusion to the final 2–3 sentences.",
  "Seam/pivot": "Drop smooth connectors once; abrupt turn is fine.",

  // Framing & Inference
  "Imply one step": "Omit an obvious inferential step; leave it implicit.",
  "Conditional framing": "Recast one key sentence as \"If/Unless …, then …\".",
  "Local contrast": "Use \"but/except/aside\" once to mark a boundary—no new facts.",
  "Scope check": "Replace one absolute with a bounded form (\"in cases like these\").",

  // Diction & Tone
  "Deflate jargon": "Swap nominalizations for verbs where safe (e.g., \"utilization\" → \"use\").",
  "Kill stock transitions": "Delete \"Moreover/Furthermore/In conclusion\" everywhere.",
  "Hedge once": "Use exactly one: \"probably/roughly/more or less.\"",
  "Drop intensifiers": "Remove \"very/clearly/obviously/significantly.\"",
  "Low-heat voice": "Prefer plain verbs; avoid showy synonyms.",

  // Concreteness & Benchmarks
  "Concrete benchmark": "Replace one vague scale with a testable one (e.g., \"enough to X\").",
  "Swap generic example": "If the source has an example, make it slightly more specific; else skip.",
  "Metric nudge": "Replace \"more/better\" with a minimal, source-safe comparator (\"more than last case\").",

  // Asymmetry & Focus
  "Cull repeats": "Delete duplicated sentences/ideas; keep the strongest instance.",

  // Formatting & Output Hygiene
  "No lists": "Force continuous prose; remove bullets/numbering.",
  "No meta": "No prefaces, apologies, or \"as requested\" scaffolding.",
  "Exact nouns": "Replace vague pronouns where antecedent is ambiguous.",
  "Quote once": "If the source contains a strong phrase, quote it once; else skip.",

  // Safety / Guardrails
  "Claim lock": "Do not add examples, scenarios, or data not present in the source.",
  "Entity lock": "Keep names, counts, and attributions exactly as given.",

  // Combo presets
  "Lean & Sharp": "Compression-medium + mixed cadence + imply one step + kill stock transitions.",
  "Analytic": "Clause surgery + front-load claim + scope check + exact nouns + no lists."
};

// Text chunking for large documents
export function chunkText(text: string, maxWords: number = 500): TextChunk[] {
  const words = text.split(/\s+/);
  const chunks: TextChunk[] = [];
  
  let currentChunk: string[] = [];
  let startIndex = 0;
  
  for (let i = 0; i < words.length; i++) {
    currentChunk.push(words[i]);
    
    if (currentChunk.length >= maxWords || i === words.length - 1) {
      const content = currentChunk.join(' ');
      const endIndex = startIndex + content.length;
      
      chunks.push({
        id: `chunk-${chunks.length + 1}`,
        content: content,
        startIndex: startIndex,
        endIndex: endIndex
      });
      
      startIndex = endIndex + 1;
      currentChunk = [];
    }
  }
  
  return chunks;
}

// Evaluate text with GPTZero
export async function evaluateWithGPTZero(text: string): Promise<number> {
  try {
    const result = await checkForAI({ content: text });
    // result.probability is AI percentage (0-100), convert to human percentage  
    const humanPercentage = 100 - result.probability;
    console.log(`GPTZero raw result:`, result, `-> Human: ${humanPercentage}%`);
    return humanPercentage;
  } catch (error) {
    console.error('GPTZero evaluation failed:', error);
    return 50; // Default to 50% if evaluation fails
  }
}

// Core humanization function
export async function performHumanization(request: HumanizerRequest): Promise<HumanizerResult> {
  const { boxA, boxB, provider, customInstructions, stylePresets } = request;
  const actualProvider = mapZhiToProvider(provider);
  
  // Get original AI score
  const originalAIScore = await evaluateWithGPTZero(boxA);
  
  // Build the humanization prompt
  const prompt = buildHumanizationPrompt(boxA, boxB, customInstructions, stylePresets);
  
  console.log(`Performing humanization with ${actualProvider}...`);
  console.log(`Original AI Score: ${originalAIScore}% Human`);
  
  let humanizedText = '';
  
  try {
    if (actualProvider === 'openai') {
      humanizedText = await callOpenAI(prompt);
    } else if (actualProvider === 'anthropic') {
      humanizedText = await callAnthropic(prompt);
    } else if (actualProvider === 'deepseek') {
      humanizedText = await callDeepSeek(prompt);
    } else if (actualProvider === 'perplexity') {
      humanizedText = await callPerplexity(prompt);
    } else {
      throw new Error(`Unsupported provider: ${actualProvider}`);
    }
    
    // Get humanized AI score
    const humanizedAIScore = await evaluateWithGPTZero(humanizedText);
    
    return {
      originalText: boxA,
      humanizedText,
      originalAIScore,
      humanizedAIScore,
      styleAnalysis: `Original text scored ${originalAIScore}% Human. After humanization using ${actualProvider}, the text now scores ${humanizedAIScore}% Human.`,
      provider: actualProvider,
      timestamp: new Date().toISOString()
    };
    
  } catch (error: any) {
    console.error(`Humanization failed with ${actualProvider}:`, error);
    throw new Error(`Humanization failed: ${error.message}`);
  }
}

// Build humanization prompt
function buildHumanizationPrompt(aiText: string, styleText: string, customInstructions?: string, stylePresets?: string[]): string {
  let prompt = `You will rewrite the content in BOX A to exactly match the writing style of BOX B. 

BOX A (Content to rewrite):
"""
${aiText}
"""

BOX B (Style template to match):
"""
${styleText}
"""

Instructions: Rewrite BOX A content to exactly match BOX B's style at the most granular level:
- Match sentence structure and rhythm patterns
- Match vocabulary choices and complexity level  
- Match grammatical constructions and syntax
- Match punctuation patterns and paragraph structure
- Match tone, voice, and rhetorical approach
- Preserve the meaning of BOX A while making it stylistically identical to BOX B

Important: This is pure style replication. Do not "improve" or "enhance" the content. Simply transform the style to match the template exactly.`;

  if (stylePresets && stylePresets.length > 0) {
    prompt += `\n\nSTYLE TECHNIQUES TO APPLY:`;
    stylePresets.forEach(preset => {
      const description = STYLE_PRESETS[preset as keyof typeof STYLE_PRESETS];
      if (description) {
        prompt += `\n• ${preset}: ${description}`;
      }
    });
  }

  if (customInstructions && customInstructions.trim()) {
    prompt += `\n\nADDITIONAL CUSTOM INSTRUCTIONS:
${customInstructions.trim()}`;
  }

  prompt += `\n\nOUTPUT ONLY THE REWRITTEN TEXT:`;

  return prompt;
}

// API call functions
async function callOpenAI(prompt: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function callAnthropic(prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content[0].text.trim();
}

async function callDeepSeek(prompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function callPerplexity(prompt: string): Promise<string> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-sonar-small-128k-online',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// Process chunked text
export async function processChunkedText(request: ChunkedHumanizerRequest): Promise<HumanizerResult> {
  const { boxA, selectedChunkIds, chunks } = request;
  
  if (!chunks || !selectedChunkIds || selectedChunkIds.length === 0) {
    return performHumanization(request);
  }
  
  const selectedChunks = chunks.filter(chunk => selectedChunkIds.includes(chunk.id));
  const textToHumanize = selectedChunks.map(chunk => chunk.content).join('\n\n');
  
  const chunkRequest = {
    ...request,
    boxA: textToHumanize
  };
  
  return performHumanization(chunkRequest);
}

// Re-rewrite function (recursive humanization)
export async function performReRewrite(text: string, styleText: string, provider: string, customInstructions?: string, stylePresets?: string[]): Promise<HumanizerResult> {
  const request: HumanizerRequest = {
    boxA: text, // Use previous output as new input
    boxB: styleText,
    provider,
    customInstructions,
    stylePresets
  };
  
  return performHumanization(request);
}