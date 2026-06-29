/**
 * Environment variable validation utility
 * Validates all required API keys and configuration at startup
 */

interface EnvConfig {
  // Required for basic functionality
  DATABASE_URL: string;
  
  // AI Service API Keys (at least one required)
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  
  // OCR and Document Processing
  MATHPIX_APP_ID?: string;
  MATHPIX_APP_KEY?: string;
  
  // Communication Services
  SENDGRID_API_KEY?: string;
  SENDGRID_VERIFIED_SENDER?: string;
  
  // Speech Services
  ASSEMBLYAI_API_KEY?: string;
  GLADIA_API_KEY?: string;
  
  // Search Services
  GOOGLE_API_KEY?: string;
  GOOGLE_CSE_ID?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    requiredMissing: number;
    optionalMissing: number;
    configured: number;
  };
}

/**
 * Validates environment variables at startup
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let requiredMissing = 0;
  let optionalMissing = 0;
  let configured = 0;

  // Check required variables
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is required but not set");
    requiredMissing++;
  } else {
    configured++;
  }

  // Check AI service keys (at least one required)
  const aiKeys = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY', 
    'DEEPSEEK_API_KEY',
    'PERPLEXITY_API_KEY'
  ];
  
  const configuredAIKeys = aiKeys.filter(key => process.env[key]);
  
  if (configuredAIKeys.length === 0) {
    errors.push("At least one AI service API key is required: " + aiKeys.join(", "));
    requiredMissing++;
  } else {
    configured += configuredAIKeys.length;
    console.log(`✓ AI Services configured: ${configuredAIKeys.join(", ")}`);
  }

  // Check Mathpix (both keys required if using OCR)
  const hasMathpixId = !!process.env.MATHPIX_APP_ID;
  const hasMathpixKey = !!process.env.MATHPIX_APP_KEY;
  
  if (hasMathpixId && !hasMathpixKey) {
    warnings.push("MATHPIX_APP_ID is set but MATHPIX_APP_KEY is missing");
    optionalMissing++;
  } else if (!hasMathpixId && hasMathpixKey) {
    warnings.push("MATHPIX_APP_KEY is set but MATHPIX_APP_ID is missing");
    optionalMissing++;
  } else if (hasMathpixId && hasMathpixKey) {
    configured += 2;
    console.log("✓ Mathpix OCR configured");
  } else {
    optionalMissing += 2;
    warnings.push("Mathpix OCR not configured (MATHPIX_APP_ID and MATHPIX_APP_KEY missing)");
  }

  // Check SendGrid
  const hasSendGridKey = !!process.env.SENDGRID_API_KEY;
  const hasSendGridSender = !!process.env.SENDGRID_VERIFIED_SENDER;
  
  if (hasSendGridKey && !hasSendGridSender) {
    warnings.push("SENDGRID_API_KEY is set but SENDGRID_VERIFIED_SENDER is missing");
    optionalMissing++;
  } else if (!hasSendGridKey && hasSendGridSender) {
    warnings.push("SENDGRID_VERIFIED_SENDER is set but SENDGRID_API_KEY is missing");
    optionalMissing++;
  } else if (hasSendGridKey && hasSendGridSender) {
    configured += 2;
    console.log("✓ SendGrid email service configured");
  } else {
    optionalMissing += 2;
    warnings.push("SendGrid email service not configured (emails will not send)");
  }

  // Check Speech services
  const speechServices = ['ASSEMBLYAI_API_KEY', 'GLADIA_API_KEY'];
  const configuredSpeechServices = speechServices.filter(key => process.env[key]);
  
  if (configuredSpeechServices.length > 0) {
    configured += configuredSpeechServices.length;
    console.log(`✓ Speech services configured: ${configuredSpeechServices.join(", ")}`);
  } else {
    optionalMissing += speechServices.length;
    warnings.push("No speech-to-text services configured");
  }

  // Check Google Search
  const hasGoogleKey = !!process.env.GOOGLE_API_KEY;
  const hasGoogleCSE = !!process.env.GOOGLE_CSE_ID;
  
  if (hasGoogleKey && !hasGoogleCSE) {
    warnings.push("GOOGLE_API_KEY is set but GOOGLE_CSE_ID is missing");
    optionalMissing++;
  } else if (!hasGoogleKey && hasGoogleCSE) {
    warnings.push("GOOGLE_CSE_ID is set but GOOGLE_API_KEY is missing");
    optionalMissing++;
  } else if (hasGoogleKey && hasGoogleCSE) {
    configured += 2;
    console.log("✓ Google Search service configured");
  } else {
    optionalMissing += 2;
    warnings.push("Google Search service not configured");
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    summary: {
      requiredMissing,
      optionalMissing,
      configured
    }
  };
}

/**
 * Logs environment validation results in a readable format
 */
export function logValidationResults(result: ValidationResult): void {
  console.log("\n🔧 Environment Configuration Check");
  console.log("=" .repeat(50));
  
  if (result.isValid) {
    console.log("✅ All required environment variables are configured");
  } else {
    console.log("❌ Missing required environment variables:");
    result.errors.forEach(error => console.log(`   • ${error}`));
  }

  if (result.warnings.length > 0) {
    console.log("\n⚠️  Optional services not configured:");
    result.warnings.forEach(warning => console.log(`   • ${warning}`));
  }

  console.log(`\n📊 Summary: ${result.summary.configured} configured, ${result.summary.requiredMissing} required missing, ${result.summary.optionalMissing} optional missing`);
  console.log("=" .repeat(50));
}

/**
 * Validates environment and exits if critical errors are found
 */
export function validateEnvironmentOrExit(): void {
  const result = validateEnvironment();
  logValidationResults(result);
  
  if (!result.isValid) {
    console.error("\n💥 Application cannot start due to missing required configuration.");
    console.error("Please configure the missing environment variables and try again.");
    process.exit(1);
  }
  
  console.log("🚀 Environment validation passed - starting application...\n");
}