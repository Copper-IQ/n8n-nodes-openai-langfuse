# Langfuse v4 Migration - n8n-nodes-openai-langfuse

## Summary

Successfully migrated from deprecated `langfuse-langchain` v3 to the new **Langfuse v4 SDK** with OpenTelemetry instrumentation.

## Key Changes

### 1. Dependencies Updated

**Removed:**
- `langfuse-langchain: ^3.0.0` (deprecated)

**Added:**
- `@langfuse/core: latest` - Core v4 SDK
- `@langfuse/langchain: latest` - LangChain integration for v4
- `@langfuse/otel: latest` - OpenTelemetry span processor
- `@opentelemetry/sdk-node: latest` - OpenTelemetry SDK

### 2. Implementation Changes

**Before (v3):**
```typescript
import { CallbackHandler } from 'langfuse-langchain';

const handler = new CallbackHandler({
    baseUrl: credentials.langfuseBaseUrl,
    publicKey: credentials.langfusePublicKey,
    secretKey: credentials.langfuseSecretKey,
    sessionId,
    userId,
});
```

**After (v4):**
```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { CallbackHandler } from '@langfuse/langchain';

// Initialize OpenTelemetry SDK with Langfuse
const langfuseSpanProcessor = new LangfuseSpanProcessor({
    publicKey: credentials.langfusePublicKey,
    secretKey: credentials.langfuseSecretKey,
    baseUrl: credentials.langfuseBaseUrl,
    exportMode: 'immediate', // CRITICAL for n8n!
});

const sdk = new NodeSDK({
    spanProcessors: [langfuseSpanProcessor],
});

sdk.start();

// Create CallbackHandler
const handler = new CallbackHandler({
    sessionId,
    userId,
    tags: customMetadata.tags || [],
});
```

### 3. Critical Configuration

**⚠️ IMPORTANT**: The `exportMode: 'immediate'` setting is **critical** for n8n integration!

Without this setting, traces will be buffered and may not be sent before n8n completes the workflow execution.

## Why v4?

1. **Old SDK Deprecated**: `langfuse-langchain` was officially deprecated in August 2025
2. **Better Reliability**: OpenTelemetry-based architecture provides robust context propagation
3. **Industry Standard**: OTEL is the observability standard, making integration easier
4. **Better Performance**: More efficient batching and flushing mechanisms
5. **Ecosystem**: Works with any OTEL-compatible library automatically

## Testing

Run the test script to verify:

```bash
node test-langfuse-v4.js
```

Check traces at:
- URL: https://prompts.accept.copperiq.com/traces
- Session ID: `test-session-v4`

## Build & Deploy

```bash
npm install --legacy-peer-deps
npm run build
npm run lint
```

## Version

- Package version bumped to `0.2.1`
- Node type version remains `3` (Responses API support)

## Files Changed

1. `package.json` - Dependencies updated
2. `nodes/LmChatOpenAiLangfuse/LmChatOpenAiLangfuse.node.ts` - Imports and supplyData method
3. `nodes/LmChatOpenAiLangfuse/utils/LangfuseCallbackHandlerWrapper.ts` - **Removed** (no longer needed)

## Usage in n8n

The node works exactly as before from the user's perspective. Simply:

1. Connect OpenAI Chat Model with Langfuse node
2. Configure Langfuse credentials (base URL, public key, secret key)
3. Set session ID, user ID, and custom metadata
4. Use in your AI workflows

Traces will now be reliably sent to Langfuse using the v4 SDK!

### Linking Prompts to Traces

To link traces to Langfuse prompts (for metrics and versioning):

1. Use the Langfuse node to compile/fetch a prompt
2. Pass the prompt data in the `customMetadata` field with the key `langfusePrompt`:

```json
{
    "langfusePrompt": {{ $input.item.json.toJsonString() }}
}
```

The node will automatically extract and pass this to ChatOpenAI's metadata, which LangChain uses to link generations to prompts.

**Example n8n workflow:**
- **Node 1**: Langfuse node (compilePrompt operation) → outputs prompt data
- **Node 2**: OpenAI Chat Model with Langfuse → set customMetadata to `{ "langfusePrompt": {{ $input.item.json.toJsonString() }} }`
- **Node 3**: AI Agent → uses the model from Node 2

Now all generations will be linked to the specific prompt version in Langfuse!

## Troubleshooting

If traces don't appear:

1. Verify credentials are correct
2. Check Langfuse URL is accessible
3. Ensure `exportMode: 'immediate'` is set in LangfuseSpanProcessor
4. Check n8n logs for errors
5. Verify OpenTelemetry SDK started successfully

## References

- Langfuse v4 Docs: https://langfuse.com/docs/observability/sdk/typescript/overview
- LangChain Integration: https://langfuse.com/docs/integrations/langchain/typescript
- OpenTelemetry: https://opentelemetry.io/
