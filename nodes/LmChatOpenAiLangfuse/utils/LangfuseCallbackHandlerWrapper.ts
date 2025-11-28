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
        // If estimatedTokenUsage exists but tokenUsage doesn't, map it
        if (output.llmOutput?.estimatedTokenUsage && !output.llmOutput?.tokenUsage) {
            output.llmOutput.tokenUsage = output.llmOutput.estimatedTokenUsage;
        }
        
        // Call the original handler
        return super.handleLLMEnd(output, runId, parentRunId);
    }
}
