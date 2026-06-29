import { analyzeCoherence } from './services/coherenceMeter';

const example1 = `Sense-perceptions do not have to be deciphered if their contents are to be uploaded, the reason being that they are presentations, not representations. Linguistic expressions do have to be deciphered if their contents are to be uploaded, the reason being that they are representations, not presentations. It is viciously regressive to suppose that information-bearing mental entities are categorically in the nature of representations, as opposed to presentations, and it is therefore incoherent to suppose that thought is mediated by expressions or, therefore, by linguistic entities. Attempts to neutralize this criticism inevitably overextend the concept of what it is to be a linguistic symbol, the result being that such attempts eviscerate the very position that it is their purpose to defend. Also, it is inherent in the nature of such attempts that they assume the truth of the view that for a given mental entity to bear this as opposed to that information is for that entity to have this as opposed to that causal role. This view is demonstrably false, dooming to failure the just-mentioned attempts to defend the contention that thought is in all cases mediated by linguistic symbols.`;

const example2 = `In this dissertation, I critically examine the philosophy of transcendental empiricism. Transcendental empiricism is, among other things, a philosophy of mental content. It attempts to dissolve an epistemological dilemma of mental content by splitting the difference between two diametrically opposed accounts of content. John McDowell's minimal empiricism and Richard Gaskin's minimalist empiricism are two versions of transcendental empiricism. Transcendental empiricism itself originates with McDowell's work. This dissertation is divided into five parts. First, in the Introduction, I state the Wittgensteinian metaphilosophical orientation of transcendental empiricism. This metaphilosophical approach provides a plateau upon which much of the rest of this work may be examined. Second, I offer a detailed description of McDowell's minimal empiricism. Third, I critique Gaskin's critique and modification of McDowell's minimal empiricism. I argue that (1) Gaskin's critiques are faulty and that (2) Gaskin's minimalist empiricism is very dubious. Fourth, I scrutinize the alleged credentials of McDowell's minimal empiricism. I argue that McDowell's version of linguistic idealism is problematic. I then comment on a recent dialogue between transcendental empiricism and Hubert Dreyfus's phenomenology. The dialogue culminates with Dreyfus's accusation of the "Myth of the Mental." I argue that this accusation is correct in which case McDowell's direct realism is problematic. I conclude that minimal empiricism does not dissolve the dilemma of mental content. Finally, I argue that Tyler Burge successfully undermines the doctrine of disjunctivism, but disjunctivism is crucial for transcendental empiricism. Ultimately, however, I aim to show that transcendental empiricism is an attractive alternative to philosophies of mental content.`;

const example3 = `Drinking coffee every morning boosts intelligence by stimulating brain cells to multiply rapidly, creating new neural pathways that enhance problem-solving abilities and memory retention, as shown in surveys where regular coffee drinkers consistently score higher on IQ tests compared to non-drinkers.`;

async function testCoherenceMeter() {
  console.log("Testing Coherence Meter with Grok's Examples\n");
  console.log("=" + "=".repeat(70) + "\n");

  console.log("TEST CASE 1: Sense-Perceptions Paragraph");
  console.log("Expected Score: 9.5/10 (tight deductive flow, hierarchical structure)\n");
  const result1 = await analyzeCoherence(example1);
  console.log(`ACTUAL SCORE: ${result1.score}/10`);
  console.log(`ASSESSMENT: ${result1.assessment}`);
  console.log(`Internal Logic: ${result1.subscores.internalLogic}/10`);
  console.log(`Clarity: ${result1.subscores.clarity}/10`);
  console.log(`Structural Unity: ${result1.subscores.structuralUnity}/10`);
  console.log(`Faux-Coherence Detection: ${result1.subscores.fauxCoherenceDetection}/10`);
  console.log(`\nMatch: ${result1.score >= 9 ? "✓ PASS" : "✗ FAIL (expected ≥9)"}\n`);
  console.log("=" + "=".repeat(70) + "\n");

  console.log("TEST CASE 2: Transcendental Empiricism Abstract");
  console.log("Expected Score: 1.5/10 (faux-placeholder coherence, buzzwords without grounding)\n");
  const result2 = await analyzeCoherence(example2);
  console.log(`ACTUAL SCORE: ${result2.score}/10`);
  console.log(`ASSESSMENT: ${result2.assessment}`);
  console.log(`Internal Logic: ${result2.subscores.internalLogic}/10`);
  console.log(`Clarity: ${result2.subscores.clarity}/10`);
  console.log(`Structural Unity: ${result2.subscores.structuralUnity}/10`);
  console.log(`Faux-Coherence Detection: ${result2.subscores.fauxCoherenceDetection}/10`);
  console.log(`\nMatch: ${result2.score <= 3 ? "✓ PASS" : "✗ FAIL (expected ≤3)"}\n`);
  console.log("=" + "=".repeat(70) + "\n");

  console.log("TEST CASE 3: Coffee Paragraph");
  console.log("Expected Score: 9.5/10 (clear causal chain, perfect internal logic despite falsehood)\n");
  const result3 = await analyzeCoherence(example3);
  console.log(`ACTUAL SCORE: ${result3.score}/10`);
  console.log(`ASSESSMENT: ${result3.assessment}`);
  console.log(`Internal Logic: ${result3.subscores.internalLogic}/10`);
  console.log(`Clarity: ${result3.subscores.clarity}/10`);
  console.log(`Structural Unity: ${result3.subscores.structuralUnity}/10`);
  console.log(`Faux-Coherence Detection: ${result3.subscores.fauxCoherenceDetection}/10`);
  console.log(`\nMatch: ${result3.score >= 9 ? "✓ PASS" : "✗ FAIL (expected ≥9)"}\n`);
  console.log("=" + "=".repeat(70) + "\n");

  console.log("SUMMARY:");
  console.log(`Test 1 (Sense-Perceptions): ${result1.score >= 9 ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`Test 2 (Transcendental Empiricism): ${result2.score <= 3 ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`Test 3 (Coffee): ${result3.score >= 9 ? "✓ PASS" : "✗ FAIL"}`);
  
  process.exit(0);
}

testCoherenceMeter().catch(console.error);
