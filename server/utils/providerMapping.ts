// Map ZHI names to actual provider names
export function mapZhiToProvider(zhiName: string): string {
  const mapping: Record<string, string> = {
    'zhi1': 'openai',
    'zhi2': 'anthropic', 
    'zhi3': 'deepseek',
    'zhi4': 'perplexity'
  };
  return mapping[zhiName] || zhiName;
}