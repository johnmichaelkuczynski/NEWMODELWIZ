import { TranslationInput } from "../components/TranslationInput";

export default function TranslationPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Document Translation Service</h1>
      <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
        Translate large documents (up to 500,000 words) using our advanced multi-tiered chunking system.
        The system divides your document into manageable pieces for reliable and complete translation.
      </p>
      <TranslationInput />
    </div>
  );
}