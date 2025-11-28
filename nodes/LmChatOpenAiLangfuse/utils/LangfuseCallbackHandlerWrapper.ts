import { CallbackHandler } from 'langfuse-langchain';
import type { LLMResult } from '@langchain/core/outputs';

/**
 * Wrapper around Langfuse CallbackHandler that adds support for estimatedTokenUsage
 * from OpenAI Responses API.
 * 
 * The Responses API returns llmOutput.estimatedTokenUsage instead of llmOutput.tokenUsage,
 * but langfuse-langchain only looks for tokenUsage. This wrapper maps estimatedTokenUsage
 * to tokenUsage before passing to the original handler.
 */
export class LangfuseCallbackHandlerWrapper extends CallbackHandler {
    async handleLLMEnd(output: LLMResult, runId: string, parentRunId?: string): Promise<void> {
        console.log('[LangfuseCallbackHandlerWrapper] handleLLMEnd called');
        console.log('[LangfuseCallbackHandlerWrapper] output.llmOutput:', JSON.stringify(output.llmOutput, null, 2));
        console.log('[LangfuseCallbackHandlerWrapper] runId:', runId);
        console.log('[LangfuseCallbackHandlerWrapper] parentRunId:', parentRunId);
        
        // If estimatedTokenUsage exists but tokenUsage doesn't, map it
        if (output.llmOutput?.estimatedTokenUsage && !output.llmOutput?.tokenUsage) {
            console.log('[LangfuseCallbackHandlerWrapper] Mapping estimatedTokenUsage to tokenUsage');
            console.log('[LangfuseCallbackHandlerWrapper] estimatedTokenUsage:', JSON.stringify(output.llmOutput.estimatedTokenUsage, null, 2));
            output.llmOutput.tokenUsage = output.llmOutput.estimatedTokenUsage;
            console.log('[LangfuseCallbackHandlerWrapper] After mapping, tokenUsage:', JSON.stringify(output.llmOutput.tokenUsage, null, 2));
        } else {
            console.log('[LangfuseCallbackHandlerWrapper] No mapping needed. estimatedTokenUsage:', !!output.llmOutput?.estimatedTokenUsage, 'tokenUsage:', !!output.llmOutput?.tokenUsage);
        }
        
        // Call the original handler
        console.log('[LangfuseCallbackHandlerWrapper] Calling super.handleLLMEnd');
        return super.handleLLMEnd(output, runId, parentRunId);
    }
}
