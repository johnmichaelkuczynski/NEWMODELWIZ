import { executeFourPhaseProtocol } from './services/fourPhaseProtocol';

const KUCZYNSKI_TEXT = `Sense-perceptions do not have to be deciphered if their contents are to be uploaded, the reason being that they are presentations, not representations. Linguistic expressions do have to be deciphered if their contents are to be uploaded, the reason being that they are representations, not presentations. It is viciously regressive to suppose that information-bearing mental entities are categorically in the nature of representations, as opposed to presentations, and it is therefore incoherent to suppose that thought is mediated by expressions or, therefore, by linguistic entities. Attempts to neutralize this criticism inevitably overextend the concept of what it is to be a linguistic symbol, the result being that such attempts eviscerate the very position that it is their purpose to defend. Also, it is inherent in the nature of such attempts that they assume the truth of the view that for a given mental entity to bear this as opposed to that information is for that entity to have this as opposed to that causal role. This view is demonstrably false, dooming to failure the just-mentioned attempts to defend the contention that thought is in all cases mediated by linguistic symbols.`;

const MCDOWELL_ABSTRACT = `In this dissertation, I critically examine the philosophy of transcendental empiricism. Transcendental empiricism is, among other things, a philosophy of mental content. It attempts to dissolve an epistemological dilemma of mental content by splitting the difference between two diametrically opposed accounts of content. John McDowell's minimal empiricism and Richard Gaskin's minimalist empiricism are two versions of transcendental empiricism. Transcendental empiricism itself originates with McDowell's work. This dissertation is divided into five parts. First, in the Introduction, I state the Wittgensteinian metaphilosophical orientation of transcendental empiricism. This metaphilosophical approach provides a plateau upon which much of the rest of this work may be examined. Second, I offer a detailed description of McDowell's minimal empiricism. Third, I critique Gaskin's critique and modification of McDowell's minimal empiricism. I argue that (1) Gaskin's critiques are faulty and that (2) Gaskin's minimalist empiricism is very dubious. Fourth, I scrutinize the alleged credentials of McDowell's minimal empiricism. I argue that McDowell's version of linguistic idealism is problematic. I then comment on a recent dialogue between transcendental empiricism and Hubert Dreyfus's phenomenology. The dialogue culminates with Dreyfus's accusation of the "Myth of the Mental." I argue that this accusation is correct in which case McDowell's direct realism is problematic. I conclude that minimal empiricism does not dissolve the dilemma of mental content. Finally, I argue that Tyler Burge successfully undermines the doctrine of disjunctivism, but disjunctivism is crucial for transcendental empiricism. Ultimately, however, I aim to show that transcendental empiricism is an attractive alternative to philosophies of mental content.`;

const FURSTENBERG_PROOF = `We prove there are infinitely many primes using topology on ℤ.
Let the basis for the topology consist of all (two-sided) arithmetic progressions {a + bd | b ∈ ℤ} where d > 0 and a ∈ ℤ. This forms a basis for a topology on ℤ. Each basis element is infinite and clopen (both open and closed), as its complement is a finite union of other arithmetic progressions with the same difference d.
Every non-empty open set contains a basis element, hence is infinite.
Suppose there are only finitely many primes p_1, ..., p_r. For each i, the set of multiples of p_i is p_i ℤ = 0 + p_i ℤ, a basis element, hence clopen.
Let U = ∪_{i=1}^r p_i ℤ. Then U is a finite union of clopen sets, hence clopen.
U contains every integer divisible by at least one prime p_i. The only integers not in U are those with no prime factor, i.e., -1 and 1. (Note 0 is in every p_i ℤ.)
Thus U = ℤ \\ {-1, 1}.
Since U is clopen, its complement {-1, 1} is clopen, hence open. But {-1, 1} is finite and non-empty, while every non-empty open set is infinite—a contradiction.
Therefore there are infinitely many primes.`;

interface TestCase {
  name: string;
  text: string;
  expectedScore: number;
  expectedRange: [number, number];
}

const testCases: TestCase[] = [
  {
    name: "Document A: Kuczynski Perception Paragraph",
    text: KUCZYNSKI_TEXT,
    expectedScore: 98,
    expectedRange: [95, 100]
  },
  {
    name: "Document B: McDowell Abstract (Faux-Intellectual)",
    text: MCDOWELL_ABSTRACT,
    expectedScore: 14,
    expectedRange: [10, 20]
  },
  {
    name: "Document C: Furstenberg Topological Proof",
    text: FURSTENBERG_PROOF,
    expectedScore: 97,
    expectedRange: [95, 100]
  }
];

async function runTests() {
  console.log("Testing Intelligence Assessment with Grok's Calibration Examples\n");
  console.log("=".repeat(70));

  const results = [];

  for (const testCase of testCases) {
    console.log(`\nTEST CASE: ${testCase.name}`);
    console.log(`Expected Score: ${testCase.expectedScore}/100 (Range: ${testCase.expectedRange[0]}-${testCase.expectedRange[1]})`);
    console.log("-".repeat(70));

    try {
      const result = await executeFourPhaseProtocol(testCase.text, "openai");
      const actualScore = result.overallScore;
      
      const inRange = actualScore >= testCase.expectedRange[0] && actualScore <= testCase.expectedRange[1];
      const status = inRange ? "✓ PASS" : "✗ FAIL";
      
      console.log(`\nACTUAL SCORE: ${actualScore}/100`);
      console.log(`STATUS: ${status}`);
      
      if (!inRange) {
        const diff = actualScore - testCase.expectedScore;
        console.log(`DEVIATION: ${diff > 0 ? '+' : ''}${diff} points`);
      }

      results.push({
        name: testCase.name,
        expected: testCase.expectedScore,
        actual: actualScore,
        passed: inRange
      });

    } catch (error: any) {
      console.log(`ERROR: ${error.message}`);
      results.push({
        name: testCase.name,
        expected: testCase.expectedScore,
        actual: null,
        passed: false,
        error: error.message
      });
    }

    console.log("=".repeat(70));
  }

  console.log("\n\nSUMMARY:");
  console.log("=".repeat(70));
  for (const result of results) {
    const status = result.passed ? "✓ PASS" : "✗ FAIL";
    const scoreInfo = result.actual !== null 
      ? `${result.actual}/100 (expected ${result.expected}/100)`
      : `ERROR: ${result.error}`;
    console.log(`${status} - ${result.name}: ${scoreInfo}`);
  }

  const passCount = results.filter(r => r.passed).length;
  console.log(`\nTotal: ${passCount}/${results.length} tests passed`);
  console.log("=".repeat(70));
}

runTests().catch(console.error);
