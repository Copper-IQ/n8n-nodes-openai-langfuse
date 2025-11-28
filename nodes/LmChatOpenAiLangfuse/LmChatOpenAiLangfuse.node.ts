import { ChatOpenAI, type ClientOptions } from '@langchain/openai';
import pick from 'lodash/pick';
import {
    jsonParse,
    type IDataObject,
    type INodeType,
    type INodeTypeDescription,
    type ISupplyDataFunctions,
    type SupplyData,
} from 'n8n-workflow';

import { formatBuiltInTools, prepareAdditionalResponsesParams } from './common';
import { searchModels } from './methods/loadModels';
import type { ModelOptions } from './types';
import { N8nLlmTracing } from './utils/N8nLlmTracing';
import { LangfuseCallbackHandlerWrapper } from './utils/LangfuseCallbackHandlerWrapper';


export class LmChatOpenAiLangfuse implements INodeType {
    methods = {
        listSearch: {
            searchModels,
        },
    };

    description: INodeTypeDescription = {
        displayName: 'OpenAI Chat Model with Langfuse',

        name: 'lmChatOpenAiLangfuse',
        icon: { light: 'file:LmChatOpenAiWithLangfuseLight.icon.svg', dark: 'file:LmChatOpenAiWithLangfuseDark.icon.svg' },
        group: ['transform'],
        version: [1, 2, 3],
        description: 'For advanced usage with an AI chain',
        defaults: {
            name: 'OpenAI Chat Model with Langfuse',
        },
        codex: {
            categories: ['AI'],
            subcategories: {
                AI: ['Language Models', 'Root Nodes'],
                'Language Models': ['Chat Models (Recommended)'],
            },
            resources: {
                primaryDocumentation: [
                    {
                        url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenai/',
                    },
                ],
            },
        },

        inputs: [],
        // Cast to any to maintain compatibility across n8n type versions where 'ai_languageModel'
        // may not yet be part of NodeConnectionType in local typings but is supported at runtime
        outputs: ['ai_languageModel' as any],
        outputNames: ['Model'],
        credentials: [
            { name: 'openAiApiWithLangfuseApi', required: true },
        ],
        requestDefaults: {
            ignoreHttpStatusErrors: true,
            baseURL:
                '={{ $parameter.options?.baseURL?.split("/").slice(0,-1).join("/") || $credentials?.url?.split("/").slice(0,-1).join("/") || "https://api.openai.com" }}',
        },
        properties: [
            {
                displayName: 'Credential',
                name: 'openAiApiWithLangfuseApi',
                type: 'credentials',
                default: '',
                required: true,
            },
            // Langfuse metadata

            {
                displayName: 'Langfuse Metadata',
                name: 'langfuseMetadata',
                type: 'collection',
                default: {},
                options: [
                    {
                        displayName: 'Custom Metadata (JSON)',
                        name: 'customMetadata',
                        type: 'json',
                        default: `{
    "project": "example-project",
    "env": "dev",
    "workflow": "main-flow"
}`,
                        description: "Optional. Pass extra metadata to be attached to Langfuse traces."
                        ,
                    },
                    {
                        displayName: 'Session ID',
                        name: 'sessionId',
                        type: 'string',
                        default: 'default-session-id',
                        description: 'Used in Langfuse trace grouping (langfuse_session_id)',
                    },
                    {
                        displayName: 'User ID',
                        name: 'userId',
                        type: 'string',
                        default: '',
                        description: 'Optional: for trace attribution (langfuse_user_id)',
                    }
                ],
            },
            // Model
            {
                displayName:
                    'If using JSON response format, you must include word "json" in the prompt in your chain or agent. Also, make sure to select latest models released post November 2023.',
                name: 'notice',
                type: 'notice',
                default: '',
                displayOptions: {
                    show: {
                        '/options.responseFormat': ['json_object'],
                    },
                },
            },
            {
                displayName: 'Model',
                name: 'model',
                type: 'options',
                description:
                    'The model which will generate the completion. <a href="https://beta.openai.com/docs/models/overview">Learn more</a>.',
                typeOptions: {
                    loadOptions: {
                        routing: {
                            request: {
                                method: 'GET',
                                url: '={{ $parameter.options?.baseURL?.split("/").slice(-1).pop() || $credentials?.url?.split("/").slice(-1).pop() || "v1" }}/models',
                            },
                            output: {
                                postReceive: [
                                    {
                                        type: 'rootProperty',
                                        properties: {
                                            property: 'data',
                                        },
                                    },
                                    {
                                        type: 'filter',
                                        properties: {
                                            // If the baseURL is not set or is set to api.openai.com, include only chat models
                                            pass: `= {{
												($parameter.options?.baseURL && !$parameter.options?.baseURL?.startsWith('https://api.openai.com/')) ||
                    ($credentials?.url && !$credentials.url.startsWith('https://api.openai.com/')) ||
                    $responseItem.id.startsWith('ft:') ||
                    $responseItem.id.startsWith('o1') ||
                    $responseItem.id.startsWith('o3') ||
                    ($responseItem.id.startsWith('gpt-') && !$responseItem.id.includes('instruct'))
											}}`,
                                        },
                                    },
                                    {
                                        type: 'setKeyValue',
                                        properties: {
                                            name: '={{$responseItem.id}}',
                                            value: '={{$responseItem.id}}',
                                        },
                                    },
                                    {
                                        type: 'sort',
                                        properties: {
                                            key: 'name',
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                routing: {
                    send: {
                        type: 'body',
                        property: 'model',
                    },
                },
                default: '',
                displayOptions: {
                    hide: {
                        '@version': [{ _cnd: { gte: 3 } }],
                    },
                },
            },
            {
                displayName: 'Model',
                name: 'model',
                type: 'resourceLocator',
                default: { mode: 'list', value: 'gpt-4.1-mini' },
                required: true,
                modes: [
                    {
                        displayName: 'From List',
                        name: 'list',
                        type: 'list',
                        placeholder: 'Select a model...',
                        typeOptions: {
                            searchListMethod: 'searchModels',
                            searchable: true,
                        },
                    },
                    {
                        displayName: 'ID',
                        name: 'id',
                        type: 'string',
                        placeholder: 'gpt-4.1-mini',
                    },
                ],
                description: 'The model. Choose from the list, or specify an ID.',
                displayOptions: {
                    hide: {
                        '@version': [{ _cnd: { lte: 2 } }],
                    },
                },
            },
            {
                displayName:
                    'When using non-OpenAI models via "Base URL" override, not all models might be chat-compatible or support other features, like tools calling or JSON response format',
                name: 'notice',
                type: 'notice',
                default: '',
                displayOptions: {
                    show: {
                        '/options.baseURL': [{ _cnd: { exists: true } }],
                    },
                },
            },
            {
                displayName: 'Use Responses API',
                name: 'responsesApiEnabled',
                type: 'boolean',
                default: true,
                description:
                    'Whether to use the Responses API to generate the response. <a href="https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenai/#use-responses-api">Learn more</a>.',
                displayOptions: {
                    show: {
                        '@version': [{ _cnd: { gte: 3 } }],
                    },
                },
            },
            {
                displayName: 'Built-in Tools',
                name: 'builtInTools',
                placeholder: 'Add Built-in Tool',
                type: 'collection',
                default: {},
                options: [
                    {
                        displayName: 'Web Search',
                        name: 'webSearch',
                        type: 'collection',
                        default: { searchContextSize: 'medium' },
                        options: [
                            {
                                displayName: 'City',
                                name: 'city',
                                type: 'string',
                                default: '',
                                placeholder: 'e.g. New York, London',
                            },
                            {
                                displayName: 'Country',
                                name: 'country',
                                type: 'string',
                                default: '',
                                placeholder: 'e.g. US, GB',
                            },
                            {
                                displayName: 'Region',
                                name: 'region',
                                type: 'string',
                                default: '',
                                placeholder: 'e.g. New York, London',
                            },
                            {
                                displayName: 'Search Context Size',
                                name: 'searchContextSize',
                                type: 'options',
                                default: 'medium',
                                description:
                                    'High level guidance for the amount of context window space to use for the search',
                                options: [
                                    { name: 'Low', value: 'low' },
                                    { name: 'Medium', value: 'medium' },
                                    { name: 'High', value: 'high' },
                                ],
                            },
                            {
                                displayName: 'Web Search Allowed Domains',
                                name: 'allowedDomains',
                                type: 'string',
                                default: '',
                                description:
                                    'Comma-separated list of domains to search. Only domains in this list will be searched.',
                                placeholder: 'e.g. google.com, wikipedia.org',
                            },
                        ],
                    },
                    {
                        displayName: 'File Search',
                        name: 'fileSearch',
                        type: 'collection',
                        default: { vectorStoreIds: '[]' },
                        options: [
                            {
                                displayName: 'Vector Store IDs',
                                name: 'vectorStoreIds',
                                description:
                                    'The vector store IDs to use for the file search. Vector stores are managed via OpenAI Dashboard. <a href="https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenai/#built-in-tools">Learn more</a>.',
                                type: 'json',
                                default: '[]',

                            },
                            {
                                displayName: 'Filters',
                                name: 'filters',
                                type: 'json',
                                default: '{}',
                            },
                            {
                                displayName: 'Max Results',
                                name: 'maxResults',
                                type: 'number',
                                default: 1,
                                typeOptions: { minValue: 1, maxValue: 50 },
                            },
                        ],
                    },
                    {
                        displayName: 'Code Interpreter',
                        name: 'codeInterpreter',
                        type: 'boolean',
                        default: true,
                        description: 'Whether to allow the model to execute code in a sandboxed environment',
                    },
                ],
                displayOptions: {
                    show: {
                        '@version': [{ _cnd: { gte: 3 } }],
                        '/responsesApiEnabled': [true],
                    },
                },
            },
            {
                displayName: 'Options',
                name: 'options',
                placeholder: 'Add Option',
                description: 'Additional options to add',
                type: 'collection',
                default: {},
                options: [
                    {
                        displayName: 'Base URL',
                        name: 'baseURL',
                        default: 'https://api.openai.com/v1',
                        description: 'Override the default base URL for the API',
                        type: 'string',
                        displayOptions: {
                            hide: {
                                '@version': [{ _cnd: { gte: 2 } }],
                            },
                        },
                    },
                    {
                        displayName: 'Conversation ID',
                        name: 'conversationId',
                        default: '',
                        description:
                            'The conversation that this response belongs to. Input items and output items from this response are automatically added to this conversation after this response completes.',
                        type: 'string',
                        displayOptions: {
                            show: {
                                '@version': [{ _cnd: { gte: 3 } }],
                                '/responsesApiEnabled': [true],
                            },
                        },
                    },
                    {
                        displayName: 'Frequency Penalty',
                        name: 'frequencyPenalty',
                        default: 0,
                        typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
                        description:
                            "Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim",
                        type: 'number',
                    },
                    {
                        displayName: 'Max Retries',
                        name: 'maxRetries',
                        default: 2,
                        description: 'Maximum number of retries to attempt',
                        type: 'number',
                    },
                    {
                        displayName: 'Maximum Number of Tokens',
                        name: 'maxTokens',
                        default: -1,
                        description:
                            'The maximum number of tokens to generate in the completion. Most models have a context length of 2048 tokens (except for the newest models, which support 32,768).',
                        type: 'number',
                        typeOptions: {
                            maxValue: 32768,
                        },
                    },
                    {
                        displayName: 'Metadata',
                        name: 'metadata',
                        type: 'json',
                        description:
                            'Set of 16 key-value pairs that can be attached to an object. This can be useful for storing additional information about the object in a structured format, and querying for objects via API or the dashboard. Keys are strings with a maximum length of 64 characters. Values are strings with a maximum length of 512 characters.',
                        default: '{}',
                        displayOptions: {
                            show: {
                                '@version': [{ _cnd: { gte: 3 } }],
                                '/responsesApiEnabled': [true],
                            },
                        },
                    },
                    {
                        displayName: 'Presence Penalty',
                        name: 'presencePenalty',
                        default: 0,
                        typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
                        description:
                            "Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics",
                        type: 'number',
                    },
                    {
                        displayName: 'Prompt Cache Key',
                        name: 'promptCacheKey',
                        type: 'string',
                        default: '',
                        description:
                            'Used by OpenAI to cache responses for similar requests to optimize your cache hit rates',
                        displayOptions: {
                            show: {
                                '@version': [{ _cnd: { gte: 3 } }],
                                '/responsesApiEnabled': [true],
                            },
                        },
                    },
                    {
                        displayName: 'Reasoning Effort',
                        name: 'reasoningEffort',
                        default: 'medium',
                        description:
                            'Controls the amount of reasoning tokens to use. A value of "low" will favor speed and economical token usage, "high" will favor more complete reasoning at the cost of more tokens generated and slower responses.',
                        type: 'options',
                        options: [
                            {
                                name: 'Low',
                                value: 'low',
                                description: 'Favors speed and economical token usage',
                            },
                            {
                                name: 'Medium',
                                value: 'medium',
                                description: 'Balance between speed and reasoning accuracy',
                            },
                            {
                                name: 'High',
                                value: 'high',
                                description:
                                    'Favors more complete reasoning at the cost of more tokens generated and slower responses',
                            },
                        ],
                        displayOptions: {
                            show: {
                                // reasoning_effort is only available on o1, o1-versioned, or on o3-mini and beyond, and gpt-5 models. Not on o1-mini or other GPT-models.
                                '/model': [{ _cnd: { regex: '(^o1([-\\d]+)?$)|(^o[3-9].*)|(^gpt-5.*)' } }],
                            },
                        },
                    },
                    {
                        displayName: 'Response Format',
                        name: 'responseFormat',
                        default: 'text',
                        type: 'options',
                        options: [
                            {
                                name: 'Text',
                                value: 'text',
                                description: 'Regular text response',
                            },
                            {
                                name: 'JSON',
                                value: 'json_object',
                                description:
                                    'Enables JSON mode, which should guarantee the message the model generates is valid JSON',
                            },
                        ],
                        displayOptions: {
                            show: {
                                '@version': [{ _cnd: { lte: 2 } }],
                            },
                        },
                    },
                    {
                        displayName: 'Safety Identifier',
                        name: 'safetyIdentifier',
                        type: 'string',
                        default: '',
                        description:
                            "A stable identifier used to help detect users of your application that may be violating OpenAI's usage policies. The IDs should be a string that uniquely identifies each user.",
                        displayOptions: {
                            show: {
                                '@version': [{ _cnd: { gte: 3 } }],
                                '/responsesApiEnabled': [true],
                            },
                        },
                    },
                    {
                        displayName: 'Sampling Temperature',
                        name: 'temperature',
                        default: 0.7,
                        typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
                        description:
                            'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
                        type: 'number',
                    },
                    {
                        displayName: 'Service Tier',
                        name: 'serviceTier',
                        type: 'options',
                        default: 'auto',
                        description: 'The service tier to use for the request',
                        options: [
                            { name: 'Auto', value: 'auto' },
                            { name: 'Flex', value: 'flex' },
                            { name: 'Default', value: 'default' },
                            { name: 'Priority', value: 'priority' },
                        ],
                        displayOptions: {
                            show: {
                                '@version': [{ _cnd: { gte: 3 } }],
                                '/responsesApiEnabled': [true],
                            },
                        },
                    },
                    {
                        displayName: 'Timeout',
                        name: 'timeout',
                        default: 60000,
                        description: 'Maximum amount of time a request is allowed to take in milliseconds',
                        type: 'number',
                    },
                    {
                        displayName: 'Top Logprobs',
                        name: 'topLogprobs',
                        type: 'number',
                        default: 0,
                        description:
                            'An integer between 0 and 20 specifying the number of most likely tokens to return at each token position, each with an associated log probability',
                        typeOptions: {
                            minValue: 0,
                            maxValue: 20,
                        },
                        displayOptions: {
                            show: {
                                '@version': [{ _cnd: { gte: 3 } }],
                                '/responsesApiEnabled': [true],
                            },
                        },
                    },
                    {
                        displayName: 'Top P',
                        name: 'topP',
                        default: 1,
                        typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
                        description:
                            'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered. We generally recommend altering this or temperature but not both.',
                        type: 'number',
                    },
                ],
            },
        ],
    };

    async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
        const credentials = await this.getCredentials('openAiApiWithLangfuseApi');

        const {
            sessionId,
            userId,
            customMetadata: customMetadataRaw = {},
        } = this.getNodeParameter('langfuseMetadata', itemIndex) as {
            sessionId: string;
            userId?: string;
            customMetadata?: string | Record<string, any>;
        };

        let customMetadata: Record<string, any> = {};


        if (typeof customMetadataRaw === 'string') {
            try {
                customMetadata = customMetadataRaw.trim()
                    ? jsonParse<Record<string, any>>(customMetadataRaw)
                    : {};
            } catch {
                customMetadata = { _raw: customMetadataRaw }; // fallback
            }
        } else if (customMetadataRaw && typeof customMetadataRaw === 'object') {
            customMetadata = customMetadataRaw as Record<string, any>;
        }

        // langfuse handler with estimatedTokenUsage support
        const lfHandler = new LangfuseCallbackHandlerWrapper({
            baseUrl: credentials.langfuseBaseUrl as string,
            publicKey: credentials.langfusePublicKey as string,
            secretKey: credentials.langfuseSecretKey as string,
            sessionId,
            userId,
        });

        console.log('[Langfuse] CallbackHandler created with session:', sessionId, 'user:', userId, 'metadata:', customMetadata);

        const version = this.getNode().typeVersion;
        console.log('[DEBUG] Node version:', version);
        
        const modelName =
            version >= 3
                ? (this.getNodeParameter('model.value', itemIndex) as string)
                : (this.getNodeParameter('model', itemIndex) as string);
        console.log('[DEBUG] Model name:', modelName);

        const responsesApiEnabled = this.getNodeParameter('responsesApiEnabled', itemIndex, false) as boolean;
        console.log('[DEBUG] responsesApiEnabled:', responsesApiEnabled);

        const options = this.getNodeParameter('options', itemIndex, {}) as ModelOptions;
        console.log('[DEBUG] Options:', JSON.stringify(options, null, 2));
        
        const builtInTools = this.getNodeParameter('builtInTools', itemIndex, {}) as IDataObject;
        console.log('[DEBUG] Built-in tools:', JSON.stringify(builtInTools, null, 2));

        const configuration: ClientOptions = {};

        if (options.baseURL) {
            configuration.baseURL = options.baseURL;
        } else if (credentials.url) {
            configuration.baseURL = credentials.url as string;
        }

        // Extra options to send to OpenAI, that are not directly supported by LangChain
        const modelKwargs: Record<string, unknown> = {};
        if (responsesApiEnabled) {
            console.log('[DEBUG] Responses API ENABLED - preparing additional params');
            const kwargs = prepareAdditionalResponsesParams(options);
            console.log('[DEBUG] Additional kwargs:', JSON.stringify(kwargs, null, 2));
            Object.assign(modelKwargs, kwargs);
        } else {
            console.log('[DEBUG] Responses API DISABLED - using standard mode');
            if (options.responseFormat) modelKwargs.response_format = { type: options.responseFormat };
            if (options.reasoningEffort && ['low', 'medium', 'high'].includes(options.reasoningEffort))
                modelKwargs.reasoning_effort = options.reasoningEffort;
        }
        console.log('[DEBUG] Final modelKwargs:', JSON.stringify(modelKwargs, null, 2));

        const includedOptions = pick(options, [
            'frequencyPenalty',
            'maxTokens',
            'presencePenalty',
            'temperature',
            'topP',
            'baseURL',
        ]);

        // Prepare metadata with tools BEFORE creating the model
        const metadata = { ...customMetadata };
        
        if (responsesApiEnabled) {
            console.log('[DEBUG] Formatting built-in tools...');
            const tools = formatBuiltInTools(
                this.getNodeParameter('builtInTools', itemIndex, {}) as IDataObject,
            );
            console.log('[DEBUG] Formatted tools:', JSON.stringify(tools, null, 2));
            if (tools.length) {
                console.log('[DEBUG] Adding', tools.length, 'tools to metadata BEFORE model creation');
                metadata.tools = tools;
            } else {
                console.log('[DEBUG] No tools to add (tools array is empty)');
            }
        }

        const fields = {
            apiKey: credentials.apiKey as string,
            model: modelName,
            ...includedOptions,
            timeout: options.timeout ?? 60000,
            maxRetries: options.maxRetries ?? 2,
            configuration,
            callbacks: [lfHandler, new N8nLlmTracing(this)],
            metadata,
            modelKwargs,
        } as any;

        if (responsesApiEnabled) {
            console.log('[DEBUG] Setting useResponsesApi=true in fields');
            fields.useResponsesApi = true;
        }
        
        console.log('[DEBUG] ChatOpenAI fields (without apiKey):', JSON.stringify({
            model: fields.model,
            timeout: fields.timeout,
            maxRetries: fields.maxRetries,
            useResponsesApi: fields.useResponsesApi,
            metadata: fields.metadata,
            modelKwargs: fields.modelKwargs,
        }, null, 2));

        const model = new ChatOpenAI(fields);

        return {
            response: model,
        };
    }
}