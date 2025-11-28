# How to Link Prompts to Executions in Langfuse

## The Problem
Traces are visible in Langfuse but executions aren't linked to prompt versions.

## The Solution
Pass the prompt object from your prompt node as `langfuse_prompt` in the **Custom Metadata** field.

## How It Works

According to Langfuse documentation, the `langfuse-langchain` CallbackHandler automatically detects the `langfuse_prompt` key in metadata and links the execution to that prompt version.

## Step-by-Step Instructions

### 1. Get Prompt from Your Prompt Node
Your prompt node returns data like this:
```json
[
  {
    "id": "e828dd59-1b95-4bb1-8bd6-c26373666b8f",
    "name": "text prompt",
    "version": 1,
    "type": "text",
    "labels": ["production", "latest"],
    "tags": [],
    "config": {
      "model": "gpt-5.1",
      "reasoning_effort": "low"
    },
    "compiledPrompt": "Say hello to Albert and tell a joke about black holes",
    "variables": {
      "name": "Albert",
      "subject": "black holes"
    }
  }
]
```

### 2. Pass the Prompt Object in Custom Metadata

In your **OpenAI Chat Model with Langfuse** node:

1. Expand **Langfuse Metadata** section
2. In the **Custom Metadata (JSON)** field, add:

```json
{
  "project": "your-project",
  "env": "production",
  "langfuse_prompt": {{ $json }}
}
```

Or if you need to select specific prompt from an array:

```json
{
  "project": "your-project",
  "env": "production",
  "langfuse_prompt": {{ $json[0] }}
}
```

### 3. That's It!

The `langfuse-langchain` CallbackHandler will automatically:
- Detect the `langfuse_prompt` key in metadata
- Extract the prompt ID and version
- Link the execution to that prompt in Langfuse UI

## Alternative: Minimal Prompt Object

If you want to minimize data, you can pass just the essential fields:

```json
{
  "langfuse_prompt": {
    "id": "{{ $json.id }}",
    "name": "{{ $json.name }}",
    "version": {{ $json.version }}
  }
}
```

**However**, passing the full prompt object is recommended as Langfuse may use additional fields for better tracking.

## Verification

After running your workflow:

1. Go to Langfuse Dashboard → **Traces**
2. Find your trace (filter by session ID or user ID)
3. Click on the generation
4. You should see:
   - **Prompt name** displayed
   - **Prompt version** number
   - **Link** to the prompt in Prompt Management

## Example Workflow

```
[Prompt Node] 
    ↓ outputs prompt object
[OpenAI Chat Model with Langfuse]
    - Custom Metadata: { "langfuse_prompt": {{ $json }} }
    ↓
[Langfuse UI]
    - Execution linked to prompt version ✅
```

## Troubleshooting

### Prompt Still Not Linked?

1. **Check the metadata is being passed**: Add console logging or check n8n execution data
2. **Verify prompt object structure**: Ensure it has `id`, `name`, and `version` fields
3. **Check Langfuse logs**: Look for any errors in Langfuse dashboard
4. **Confirm langfuse-langchain version**: This node uses `langfuse-langchain` v3.38.6 which supports this feature

### Invalid JSON Error?

Make sure to use proper n8n expression syntax:
- `{{ $json }}` for the entire object
- `{{ $json.fieldName }}` for specific fields
- Use `{{ }}` double braces for expressions

## Key Points

✅ **No code changes needed** to this node  
✅ **Works with your existing prompt node**  
✅ **Just pass the prompt object in metadata**  
✅ **Langfuse automatically handles the linking**  

## What the CallbackHandler Does

The `langfuse-langchain` CallbackHandler checks for `metadata.langfuse_prompt` and:
1. Extracts prompt ID, name, and version
2. Sends this info with the trace to Langfuse
3. Langfuse UI displays the linked prompt

That's it! No node modifications required. 🎉
