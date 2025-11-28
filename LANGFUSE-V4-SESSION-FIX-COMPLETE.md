# Langfuse v4 Session Creation - Complete Fix

## Problem
Sessions are NOT being created in Langfuse even though sessionId is passed to CallbackHandler constructor.

## Root Cause
In Langfuse v3/v4 with OTEL, passing `sessionId` to the `CallbackHandler` constructor alone is **NOT sufficient**. The sessionId must ALSO be passed via `metadata` in the LangChain invocation config with the key `langfuse_session_id`.

### Why CallbackHandler Constructor Isn't Enough

From the official Langfuse documentation and GitHub discussions:
- <cite index="40-2,40-7">You need to set the `langfuse_session_id` in metadata, not just run_name, to set the session</cite>
- <cite index="40-17">In Langfuse 3, you set the session_id by passing it as metadata in the config when invoking your workflow, not in the CallbackHandler constructor</cite>

## Solution: Two-Part Fix

### Part 1: OpenAI Chat Model Node ✅ (DONE)
**Repo**: `n8n-nodes-openai-langfuse`
**Status**: Already fixed

Pass sessionId, userId, and tags to CallbackHandler constructor:
```typescript
const lfHandler = new CallbackHandler({
    sessionId: sessionId || undefined,
    userId: userId || undefined,
    tags: tags.length > 0 ? tags : undefined,
});
```

### Part 2: Agent Node ❌ (REQUIRED)
**Repo**: `n8n-nodes-ai-agent-langfuse`
**Status**: NEEDS FIX

The agent must pass `langfuse_session_id`, `langfuse_user_id`, and `langfuse_tags` in the metadata when invoking the executor.

#### Current Code (V3)
Around line 648 in `nodes/AgentWithLangfuse/V3/execute.ts`:

```typescript
const modelResponse = await executor.invoke(
    {
        ...invokeParams,
        chat_history: chatHistory,
    },
    executeOptions,  // <-- Missing metadata!
);
```

#### Required Fix
```typescript
const modelResponse = await executor.invoke(
    {
        ...invokeParams,
        chat_history: chatHistory,
    },
    {
        ...executeOptions,
        metadata: {
            langfuse_session_id: langfuseMetadata.sessionId,
            langfuse_user_id: langfuseMetadata.userId,
            langfuse_tags: rawMetadata.tags ? rawMetadata.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        },
    },
);
```

This needs to be added in BOTH execution paths:
1. Non-streaming execution (around line 648)
2. Streaming execution (around line 588 in `executor.streamEvents()`)

## Full Implementation for Agent Node

### Location
File: `n8n-nodes-ai-agent-langfuse/nodes/AgentWithLangfuse/V3/execute.ts`

### Changes Needed

#### 1. Parse tags from rawMetadata (around line 434)
```typescript
const rawMetadata = this.getNodeParameter('langfuseMetadata', itemIndex, {}) as any;
this.logger.info('[Langfuse V3] Raw metadata from node parameter', { rawMetadata });

// Parse tags if they're a string
const tags = typeof rawMetadata.tags === 'string' 
    ? rawMetadata.tags.split(',').map(t => t.trim()).filter(Boolean) 
    : (Array.isArray(rawMetadata.tags) ? rawMetadata.tags : []);
```

#### 2. Update streaming execution (around line 588)
```typescript
const eventStream = executor.streamEvents(
    {
        ...invokeParams,
        chat_history: chatHistory,
    },
    {
        version: 'v2',
        ...executeOptions,
        metadata: {
            langfuse_session_id: langfuseMetadata.sessionId,
            langfuse_user_id: langfuseMetadata.userId,
            langfuse_tags: tags,
        },
    },
);
```

#### 3. Update non-streaming execution (around line 648)
```typescript
const modelResponse = await executor.invoke(
    {
        ...invokeParams,
        chat_history: chatHistory,
    },
    {
        ...executeOptions,
        metadata: {
            langfuse_session_id: langfuseMetadata.sessionId,
            langfuse_user_id: langfuseMetadata.userId,
            langfuse_tags: tags,
        },
    },
);
```

## Why Both Are Needed

1. **CallbackHandler constructor** (OpenAI node): Initializes the handler with context
2. **Config metadata** (Agent node): Actually sets the session on the trace when invoked

Without both, Langfuse v4 doesn't create the session properly.

## Testing

After applying both fixes:

1. ✅ Traces should be created
2. ✅ Sessions should be created with the provided sessionId
3. ✅ Traces should be grouped under the correct session
4. ✅ userId and tags should be properly attributed
5. ✅ Prompt linking should work

## References

- <cite index="40-17,40-18,40-19">Langfuse v3 documentation on setting session_id via metadata in config</cite>
- <cite index="31-9,31-10">Langfuse uses Attribute Propagation to propagate sessionId across all observations of a trace and create sessionId-level metrics</cite>
- <cite index="33-12">Official example showing langfuse_session_id, langfuse_user_id, and langfuse_tags in metadata</cite>

## Next Steps

1. ✅ Fix OpenAI Chat Model node (n8n-nodes-openai-langfuse) - DONE
2. ❌ Fix Agent node (n8n-nodes-ai-agent-langfuse) - REQUIRED
3. Build both nodes
4. Test end-to-end workflow
