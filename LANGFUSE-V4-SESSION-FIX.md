# Langfuse v4 Session Creation and Prompt Linking Fix

## Problem
The n8n-nodes-openai-langfuse node was creating traces but NOT creating sessions or linking to prompts, even though sessionId and langfusePrompt metadata were being passed.

## Root Cause
In Langfuse v4 with OTEL, the `CallbackHandler` was being instantiated **without** passing sessionId, userId, and tags to its constructor:

```typescript
// INCORRECT (old code)
const lfHandler = new CallbackHandler();
```

While sessionId/userId/tags were being added to ChatOpenAI metadata, they were **not** being passed to the CallbackHandler, which prevented:
1. Session creation in Langfuse
2. Proper trace grouping
3. Correct prompt linking context

## Solution
Pass sessionId, userId, and tags to the CallbackHandler constructor:

```typescript
// CORRECT (new code)
const lfHandler = new CallbackHandler({
    sessionId: sessionId || undefined,
    userId: userId || undefined,
    tags: tags.length > 0 ? tags : undefined,
});
```

## What Changed from V2 to V4

### V2 (Old CallbackHandler)
- Passed sessionId/userId to CallbackHandler constructor ✓
- Also passed them in execution metadata (dual approach)
- CallbackHandler handled all tracing directly

### V4 (OTEL-based)
- **MUST** pass sessionId/userId/tags to CallbackHandler constructor ✓
- OTEL handles span creation and propagation
- Metadata on ChatOpenAI becomes span attributes automatically
- CallbackHandler needs context for session creation

## Files Changed
- `nodes/LmChatOpenAiLangfuse/LmChatOpenAiLangfuse.node.ts`
  - Line ~665-672: Added sessionId, userId, tags to CallbackHandler constructor
  - Line ~82-129: Reordered parameters alphabetically (lint fix)

## Testing
After this fix:
1. Sessions should be created with the provided sessionId
2. Traces should be grouped under the correct session
3. Prompt linking via metadata should work correctly
4. userId and tags should be properly attributed

## References
- Langfuse v4 LangChain integration: https://langfuse.com/integrations/frameworks/langchain
- Official pattern: Pass sessionId, userId, tags to CallbackHandler constructor
- Prompt linking: Pass `langfusePrompt` in metadata (still works after CallbackHandler has session context)

## Build Status
✅ TypeScript compilation successful
✅ Linter passed
✅ Build output verified
