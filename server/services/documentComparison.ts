type LLMProvider = "openai" | "anthropic" | "perplexity" | "deepseek";

export interface DocumentComparisonResult {
  winnerDocument: 'A' | 'B';
  documentAScore: number;
  documentBScore: number;
  comparisonAnalysis: string;
  detailedBreakdown: string;
}

const COMPARISON_PROMPT = `GENRE-AWARE DOCUMENT COMPARISON: WHICH MAKES ITS CASE BETTER?

You are comparing two documents to determine which one makes its case more effectively using genre-appropriate criteria.

CRITICAL: Use consistent scoring standards. A document that would score 93/100 in single assessment should score similarly in comparison unless directly outperformed by a superior document.

GENRE-AWARE EVALUATION:
First identify each document's genre (PHILOSOPHICAL ARGUMENT, FORMAL PROOF, EMPIRICAL RESEARCH, HISTORICAL ANALYSIS, TECHNICAL ESSAY, THEORETICAL FRAMEWORK), then apply appropriate criteria:

PHILOSOPHICAL ARGUMENTS: Emphasize conceptual precision, logical coherence, inferential control over empirical proof
FORMAL PROOFS: Prioritize mathematical rigor, logical completeness, formal validity
EMPIRICAL RESEARCH: Focus on data quality, statistical validity, methodological soundness
HISTORICAL ANALYSIS: Value archival evidence, chronological coherence, historical methodology
TECHNICAL ESSAYS: Assess practical applicability, technical accuracy, solution effectiveness
THEORETICAL FRAMEWORKS: Evaluate systematic construction, explanatory power, theoretical coherence

For each document, you must provide:
1. ARGUMENT SUMMARY: What is the document's main argument and key claims?
2. IMPROVED RECONSTRUCTION: Present the argument in improved form - restructure and strengthen the actual argument itself while preserving its core insights. Provide this as an outline of the enhanced argument, not suggestions for improvement.

COMPARISON CRITERIA:
1. Argument Strength: Which document has stronger logical arguments?
2. Evidence Quality: Which provides better evidence for its claims?
3. Persuasiveness: Which is more convincing overall?
4. Clarity of Case: Which presents its argument more clearly?
5. Completeness: Which covers its topic more thoroughly?

SCORING SYSTEM (Use same standards as single document assessment):
- Document A Score: 0-100 (how well Document A makes its case)
- Document B Score: 0-100 (how well Document B makes its case)

CALIBRATION ANCHORS:
- Score 95-100: Comprehensive historical/systematic analysis (e.g., financial regulation with citations, formal logic proofs)
- Score 90-94: Strong academic work with solid evidence and important claims
- Score 80-89: Well-supported academic arguments with good evidence
- Score 70-79: Competent but with some gaps or limitations
- Score below 70: Significant weaknesses in case-making

CRITICAL: If a document would score 93/100 in isolation, it should score 90+ in comparison unless clearly outperformed.
Winner: The document with the higher score

RESPONSE FORMAT (NO MARKDOWN):

WINNER: Document [A or B]

DOCUMENT A SCORE: [Score]/100
DOCUMENT B SCORE: [Score]/100

DOCUMENT A ANALYSIS:
GENRE: [Identify as PHILOSOPHICAL ARGUMENT, FORMAL PROOF, EMPIRICAL RESEARCH, HISTORICAL ANALYSIS, TECHNICAL ESSAY, or THEORETICAL FRAMEWORK]

ARGUMENT SUMMARY: [Summarize the main argument and key claims of Document A]

IMPROVED RECONSTRUCTION: [Present Document A's argument in strengthened form as an outline - the actual improved argument structure, not tips for improvement]

DOCUMENT B ANALYSIS:
GENRE: [Identify as PHILOSOPHICAL ARGUMENT, FORMAL PROOF, EMPIRICAL RESEARCH, HISTORICAL ANALYSIS, TECHNICAL ESSAY, or THEORETICAL FRAMEWORK]

ARGUMENT SUMMARY: [Summarize the main argument and key claims of Document B]

IMPROVED RECONSTRUCTION: [Present Document B's argument in strengthened form as an outline - the actual improved argument structure, not tips for improvement]

COMPARISON ANALYSIS:
[Brief explanation of which document makes its case better and why]

FINAL VERDICT:
[Conclusive statement about which document makes its case better with key reasons]

DOCUMENT A:
`;

export async function compareDocuments(
  documentA: string,
  documentB: string,
  provider: LLMProvider = 'openai'
): Promise<DocumentComparisonResult> {
  // First, get absolute scores for each document individually
  const { performCaseAssessment } = await import('./caseAssessment');
  
  console.log('Getting absolute scores for both documents...');
  const scoreA = await performCaseAssessment(documentA, provider);
  const scoreB = await performCaseAssessment(documentB, provider);
  
  console.log(`Document A absolute score: ${scoreA.overallCaseScore}`);
  console.log(`Document B absolute score: ${scoreB.overallCaseScore}`);
  
  // Now perform comparison with locked-in scores
  const prompt = COMPARISON_PROMPT + 
    `\n\nIMPORTANT: Document A has been independently assessed at ${scoreA.overallCaseScore}/100 and Document B at ${scoreB.overallCaseScore}/100. Use these exact scores in your comparison - do not deviate from them.\n\n` +
    "DOCUMENT A:\n" + documentA + "\n\nDOCUMENT B:\n" + documentB;
  
  // Call the LLM directly without using the analysis functions
  let response: string;
  
  if (provider === 'openai') {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 8000
    });
    
    response = completion.choices[0].message.content || "No response available";
  } else if (provider === 'anthropic') {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      messages: [
        { role: "user", content: prompt }
      ]
    });
    
    response = completion.content[0].type === 'text' ? completion.content[0].text : "No response available";
  } else if (provider === 'deepseek') {
    const fetch = (await import('node-fetch')).default;
    
    const apiResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    });
    
    const data = await apiResponse.json() as any;
    response = data.choices?.[0]?.message?.content || "No response available";
  } else if (provider === 'perplexity') {
    const fetch = (await import('node-fetch')).default;
    
    const apiResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    });
    
    const data = await apiResponse.json() as any;
    response = data.choices?.[0]?.message?.content || "No response available";
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  
  console.log('Raw comparison response:', response.substring(0, 500) + '...');
  return parseComparisonResponse(response, scoreA.overallCaseScore, scoreB.overallCaseScore);
}

function parseComparisonResponse(response: string, lockedScoreA: number, lockedScoreB: number): DocumentComparisonResult {
  const cleanResponse = response.replace(/\*\*/g, '').replace(/\*/g, '').replace(/```/g, '');
  
  console.log('Parsing comparison response. Response length:', cleanResponse.length);
  console.log('First 1000 chars:', cleanResponse.substring(0, 1000));
  
  // Use locked-in scores from individual assessments
  const documentAScore = lockedScoreA;
  const documentBScore = lockedScoreB;
  
  console.log('Using locked scores - Document A:', documentAScore, 'Document B:', documentBScore);
  
  // Determine winner based on locked-in scores
  const winnerDocument: 'A' | 'B' = documentAScore >= documentBScore ? 'A' : 'B';
  console.log('Winner determined by scores:', winnerDocument, `(A: ${documentAScore} vs B: ${documentBScore})`);
  
  // Extract document analyses
  let documentAAnalysis = '';
  let documentBAnalysis = '';
  let comparisonAnalysis = '';
  
  const docAStart = cleanResponse.indexOf('DOCUMENT A ANALYSIS:');
  const docBStart = cleanResponse.indexOf('DOCUMENT B ANALYSIS:');
  const comparisonStart = cleanResponse.indexOf('COMPARISON ANALYSIS:');
  const verdictStart = cleanResponse.indexOf('FINAL VERDICT:');
  
  if (docAStart !== -1) {
    const endPos = docBStart !== -1 ? docBStart : (comparisonStart !== -1 ? comparisonStart : cleanResponse.length);
    documentAAnalysis = cleanResponse.substring(docAStart + 20, endPos).trim();
  }
  
  if (docBStart !== -1) {
    const endPos = comparisonStart !== -1 ? comparisonStart : (verdictStart !== -1 ? verdictStart : cleanResponse.length);
    documentBAnalysis = cleanResponse.substring(docBStart + 20, endPos).trim();
  }
  
  if (comparisonStart !== -1) {
    const endPos = verdictStart !== -1 ? verdictStart : cleanResponse.length;
    comparisonAnalysis = cleanResponse.substring(comparisonStart + 19, endPos).trim();
  }
  
  // Combine all analyses into detailed breakdown
  let detailedBreakdown = '';
  if (documentAAnalysis) {
    detailedBreakdown += 'DOCUMENT A ANALYSIS:\n' + documentAAnalysis + '\n\n';
  }
  if (documentBAnalysis) {
    detailedBreakdown += 'DOCUMENT B ANALYSIS:\n' + documentBAnalysis + '\n\n';
  }
  if (verdictStart !== -1) {
    const verdict = cleanResponse.substring(verdictStart).trim();
    detailedBreakdown += verdict;
  }
  
  // If we still don't have analysis, use the entire response
  if (!comparisonAnalysis && !detailedBreakdown) {
    comparisonAnalysis = cleanResponse.trim();
  }
  
  console.log('Parsed result:', {
    winnerDocument,
    documentAScore,
    documentBScore,
    hasAnalysis: !!comparisonAnalysis,
    hasBreakdown: !!detailedBreakdown
  });
  
  return {
    winnerDocument,
    documentAScore,
    documentBScore,
    comparisonAnalysis,
    detailedBreakdown
  };
}