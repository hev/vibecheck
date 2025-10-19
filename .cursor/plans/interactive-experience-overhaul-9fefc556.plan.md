<!-- 9fefc556-bc40-49c6-88b6-c1fb702f7088 2440a86f-5828-4b05-aa0b-2544e6a5dc2b -->
# Fix Onboarding YAML Type Bug

## Problem Analysis

When users press Enter to accept defaults in onboarding, numeric fields (min_tokens, max_tokens, semantic threshold) are stored as **strings** instead of **numbers**, causing YAML validation errors.

**Root Cause:** 
- Line 122, 128, etc: `suggestion: String(helloWorldDefaults.minTokens1 || 1)` converts numbers to strings for display
- Line 267: When user presses Enter, `(data as any)[step.key] = step.suggestion;` assigns the string directly
- The numeric conversion logic (lines 270-272) only runs when user types input, not for defaults

## Solution

### 1. Store Numeric Values Separately

Instead of converting numbers to strings in suggestions, keep them as numbers and only convert for display:

```typescript
{
  question: "Minimum tokens for first eval?",
  key: 'minTokens1' as keyof OnboardingData,
  placeholder: String(helloWorldDefaults.minTokens1 || 1),
  suggestion: helloWorldDefaults.minTokens1 || 1  // Keep as number!
}
```

### 2. Update Input Handler

Ensure the input handler properly handles both string and numeric suggestions:

```typescript
const handleInput = (input: string) => {
  const trimmed = input.trim();
  const step = steps[currentStep];

  // If empty, use the suggestion (already correct type)
  if (!trimmed) {
    (data as any)[step.key] = step.suggestion;
  } else {
    // Convert user input for numeric fields
    if (step.key.includes('Tokens') || step.key === 'semanticThreshold') {
      const numValue = parseFloat(trimmed);
      (data as any)[step.key] = isNaN(numValue) ? trimmed : numValue;
    } else {
      (data as any)[step.key] = trimmed;
    }
  }

  currentStep++;
  promptNextStep();
};
```

### 3. Add Tests

Create tests to ensure numeric fields are properly typed in generated YAML:

**Test file:** `packages/cli/src/commands/onboarding.test.ts`

```typescript
describe('Onboarding YAML Generation', () => {
  it('should generate numeric values for token fields when using defaults', () => {
    const data: OnboardingData = {
      name: 'test',
      model: 'test-model',
      systemPrompt: 'test prompt',
      prompt1: 'Say Hello',
      match1: '*hello*',
      minTokens1: 1,      // Should be number
      maxTokens1: 50,     // Should be number
      // ... etc
    };
    
    const yaml = generateYAML(data);
    const parsed = YAML.parse(yaml);
    
    expect(typeof parsed.evals[0].checks.min_tokens).toBe('number');
    expect(typeof parsed.evals[0].checks.max_tokens).toBe('number');
  });
  
  it('should parse string inputs to numbers for numeric fields', () => {
    // Test that user-typed strings get converted
  });
});
```

### 4. Verify loadHelloWorldDefaults Returns Numbers

Ensure the `loadHelloWorldDefaults` function returns actual numbers, not strings:

```typescript
// Should already be correct since we're reading from YAML
defaults.minTokens1 = helloWorldData.evals[0].checks?.min_tokens || 1;
// ✓ This is correct - YAML parser returns numbers
```

## Files to Modify

1. **packages/cli/src/commands/onboarding.ts** 
   - Remove `String()` wrapper from numeric suggestion values
   - Keep placeholder as string for display
   - Verify suggestion uses raw numeric value

2. **packages/cli/src/commands/onboarding.test.ts** (NEW)
   - Add unit tests for YAML generation
   - Test numeric field types
   - Test user input conversion
   - Test default value handling

## Testing Strategy

1. **Unit tests** - Test `generateYAML` function directly
2. **Integration test** - Run full onboarding flow with all defaults
3. **Manual test** - Run `vibe` → accept all defaults → verify generated YAML validates
4. **Regression test** - Ensure existing YAML files still work

## Expected Outcome

After fix:
- Pressing Enter for numeric fields stores numbers, not strings
- Generated YAML validates successfully
- `vibe check` works immediately after onboarding
- Tests prevent future regressions


### To-dos

- [ ] Investigate why numeric fields are stored as strings in onboarding YAML
- [ ] Remove String() wrapper from numeric suggestions in onboarding steps
- [ ] Create onboarding.test.ts with tests for YAML generation and type correctness
- [ ] Test that accepting defaults produces valid numeric types
- [ ] Manually test full onboarding flow and verify generated YAML validates