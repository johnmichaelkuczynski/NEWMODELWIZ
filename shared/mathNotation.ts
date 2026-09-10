const MATH_SYMBOLS: Record<string, string> = {
  Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ", Epsilon: "Ε", Zeta: "Ζ",
  Eta: "Η", Theta: "Θ", Iota: "Ι", Kappa: "Κ", Lambda: "Λ", Mu: "Μ",
  Nu: "Ν", Xi: "Ξ", Omicron: "Ο", Pi: "Π", Rho: "Ρ", Sigma: "Σ",
  Tau: "Τ", Upsilon: "Υ", Phi: "Φ", Chi: "Χ", Psi: "Ψ", Omega: "Ω",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ϵ",
  zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ",
  lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", omicron: "ο", pi: "π",
  varpi: "ϖ", rho: "ρ", varrho: "ϱ", sigma: "σ", varsigma: "ς", tau: "τ",
  upsilon: "υ", phi: "φ", varphi: "ϕ", chi: "χ", psi: "ψ", omega: "ω",
  forall: "∀", exists: "∃", nexists: "∄", in: "∈", notin: "∉", ni: "∋",
  emptyset: "∅", infinity: "∞", infty: "∞", partial: "∂", nabla: "∇",
  sum: "∑", prod: "∏", int: "∫", therefore: "∴", because: "∵",
  equiv: "≡", neq: "≠", ne: "≠", approx: "≈", sim: "∼", simeq: "≃",
  leq: "≤", le: "≤", geq: "≥", ge: "≥", ll: "≪", gg: "≫",
  subset: "⊂", subseteq: "⊆", supset: "⊃", supseteq: "⊇",
  cup: "∪", cap: "∩", land: "∧", wedge: "∧", lor: "∨", vee: "∨", neg: "¬",
  to: "→", rightarrow: "→", leftarrow: "←", leftrightarrow: "↔",
  Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", mapsto: "↦",
  times: "×", cdot: "·", pm: "±", mp: "∓", div: "÷", setminus: "∖",
  propto: "∝", angle: "∠", degree: "°",
};

const SUBSCRIPT: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
  "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ",
  m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ", s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
};

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾",
  n: "ⁿ", i: "ⁱ",
};

function mappedCharacters(value: string, map: Record<string, string>): string {
  const converted = value.split("").map(character => map[character] || "").join("");
  return converted.length === value.length ? converted : value;
}

function convertMathExpression(expression: string): string {
  let result = expression
    .replace(/\\(?:left|right)\b/g, "")
    .replace(/\\text\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\operatorname\s*\{([^{}]*)\}/g, "$1");

  for (let pass = 0; pass < 3; pass++) {
    result = result.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "($1)/($2)");
  }

  result = result.replace(/\\([A-Za-z]+)/g, (match, command: string) => MATH_SYMBOLS[command] || match);
  result = result.replace(/_\{([^{}]+)\}|_([A-Za-z0-9+\-=()])/g, (_match, grouped, single) =>
    mappedCharacters(grouped || single, SUBSCRIPT),
  );
  result = result.replace(/\^\{([^{}]+)\}|\^([A-Za-z0-9+\-=()])/g, (_match, grouped, single) =>
    mappedCharacters(grouped || single, SUPERSCRIPT),
  );
  return result.replace(/\s+/g, " ").trim();
}

export function normalizeMathNotation(text: string): string {
  let normalized = text.replace(/\${1,2}([^$\n]+?)\${1,2}/g, (_match, expression) =>
    convertMathExpression(expression),
  );
  normalized = normalized.replace(/\\([A-Za-z]+)/g, (match, command: string) => MATH_SYMBOLS[command] || match);
  normalized = normalized.replace(/\b([A-Za-z])_\{([^{}]+)\}|\b([A-Za-z])_([A-Za-z0-9])/g,
    (_match, groupedBase, groupedIndex, singleBase, singleIndex) =>
      `${groupedBase || singleBase}${mappedCharacters(groupedIndex || singleIndex, SUBSCRIPT)}`,
  );
  normalized = normalized.replace(/\b([A-Za-z])\^\{([^{}]+)\}|\b([A-Za-z])\^([A-Za-z0-9])/g,
    (_match, groupedBase, groupedPower, singleBase, singlePower) =>
      `${groupedBase || singleBase}${mappedCharacters(groupedPower || singlePower, SUPERSCRIPT)}`,
  );
  return normalized;
}

const ASCII_FROM_SUBSCRIPT: Record<string, string> = Object.fromEntries(
  Object.entries(SUBSCRIPT).map(([plain, formatted]) => [formatted, plain]),
);
const ASCII_FROM_SUPERSCRIPT: Record<string, string> = Object.fromEntries(
  Object.entries(SUPERSCRIPT).map(([plain, formatted]) => [formatted, plain]),
);

export function preserveRequestedMathNotation(text: string, instructions: string): string {
  const requested = normalizeMathNotation(instructions);
  const requiredTokens = requested.match(/\b[A-Za-z][₀-₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+/g) || [];
  let result = text;

  for (const token of new Set(requiredTokens)) {
    const plain = token.split("").map(character =>
      ASCII_FROM_SUBSCRIPT[character] || ASCII_FROM_SUPERSCRIPT[character] || character,
    ).join("");
    result = result.replace(new RegExp(`\\b${plain}\\b`, "g"), token);
  }
  return result;
}