# Gemini API Integration

This project now uses the Gemini API to generate more realistic responses for digital clones.

## Setup

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/)
2. Add your API key to the `.env` file:

```
GEMINI_API_KEY=your_actual_api_key_here
```

## How it works

The digital clone functionality in `server/routes/clone-response.ts` now uses the Gemini API to generate responses that are more authentic to the clone's personality and characteristics.

The implementation:
- Uses the `@google/generative-ai` package
- Takes into account the clone's personality traits, writing samples, memories, and tone settings
- Generates both the clone's response and an explanation of why that response was generated
- Falls back to the original mock response system if the API call fails

## Environment Variables

- `GEMINI_API_KEY` - Your Gemini API key (required for AI features)
- `PING_MESSAGE` - Test message for health checks (optional)

## Troubleshooting

If you encounter issues with the Gemini integration:
1. Verify your API key is correct and active
2. Check that you haven't exceeded your API quota
3. Ensure your `.env` file is properly formatted
4. Check the server logs for specific error messages