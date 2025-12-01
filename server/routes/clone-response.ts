import { RequestHandler } from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface CloneData {
  name: string;
  personality: string;
  samples: string[];
  memories: string[];
  toneSettings: {
    formality: number;
    empathy: number;
    directness: number;
    length: "short" | "medium" | "detailed";
  };
}

interface CloneResponse {
  clone_reply: string;
  explanation: string;
  tags: string[];
}

// Initialize Gemini AI with API key from environment variables
const API_KEY = process.env.GEMINI_API_KEY || "";

if (!API_KEY) {
  console.warn("Warning: GEMINI_API_KEY not found in environment variables");
}

const genAI = new GoogleGenerativeAI(API_KEY);

export const handleCloneResponse: RequestHandler = async (req, res) => {
  const { query, cloneData }: { query: string; cloneData: CloneData } = req.body;

  if (!query || !cloneData) {
    res.status(400).json({ error: "Missing query or cloneData" });
    return;
  }

  const getToneTag = (formality: number): string => {
    if (formality < 33) return "casual";
    if (formality > 66) return "formal";
    return "balanced-tone";
  };

  const getEmpathyTag = (empathy: number): string => {
    if (empathy < 33) return "direct";
    if (empathy > 66) return "empathetic";
    return "balanced-empathy";
  };

  const getDirectnessTag = (directness: number): string => {
    if (directness < 33) return "subtle";
    if (directness > 66) return "straightforward";
    return "balanced-directness";
  };

  try {
    // Create a more detailed and effective prompt for Gemini
    const prompt = `
You are an AI expert at mimicking a specific person's communication style and personality. 
Your task is to respond exactly as "${cloneData.name}" would, based on the provided information.

Here is who you need to emulate:
Name: ${cloneData.name}
Personality traits and values: ${cloneData.personality}
Writing samples showing their style: 
${cloneData.samples.map((sample, i) => `${i + 1}. "${sample}"`).join('\n')}

Important memories and context that shape their perspective:
${cloneData.memories.length > 0 
  ? cloneData.memories.map((memory, i) => `${i + 1}. ${memory}`).join('\n') 
  : "No specific memories provided"}

Tone settings that should influence your response:
- Formality level: ${cloneData.toneSettings.formality}% (${cloneData.toneSettings.formality < 33 ? 'Casual' : cloneData.toneSettings.formality > 66 ? 'Formal' : 'Balanced'})
- Empathy level: ${cloneData.toneSettings.empathy}% (${cloneData.toneSettings.empathy < 33 ? 'Direct' : cloneData.toneSettings.empathy > 66 ? 'Empathetic' : 'Balanced'})
- Directness level: ${cloneData.toneSettings.directness}% (${cloneData.toneSettings.directness < 33 ? 'Subtle' : cloneData.toneSettings.directness > 66 ? 'Straightforward' : 'Balanced'})
- Preferred response length: ${cloneData.toneSettings.length}

USER'S MESSAGE: "${query}"

YOUR RESPONSE INSTRUCTIONS:
1. Respond as if you ARE ${cloneData.name}, not as an AI assistant
2. Match their writing style exactly as shown in the samples
3. Reflect their personality traits and values in your response
4. Consider their memories and context when relevant
5. Adjust your tone according to the specified settings
6. Keep your response ${cloneData.toneSettings.length === 'short' ? 'brief and to the point' : cloneData.toneSettings.length === 'detailed' ? 'comprehensive and thorough' : 'at a moderate length'}
7. Do NOT mention that you're an AI or that this is a simulation
8. Do NOT use phrases like "As ${cloneData.name}, I would say..." - just respond directly
9. Do NOT apologize or express uncertainty - respond confidently as them

RESPOND NOW AS ${cloneData.name.toUpperCase()}:
`;

    // Get the generative model (updated to a supported model)
    const model = genAI.getGenerativeModel({ model: "models/gemini-pro-latest" });
    
    // Generate response from Gemini with better parameters
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1000,
      }
    });
    
    const response = await result.response;
    const cloneReply = response.text().trim();

    // Generate explanation of why this response was chosen
    const explanationPrompt = `
Explain why ${cloneData.name} responded in this way to the query: "${query}".
Reference their personality traits (${cloneData.personality}), tone settings, and any relevant memories or writing samples.
Keep the explanation concise but informative.

Explanation:
`;

    const explanationResult = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text: explanationPrompt }]
      }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 500,
      }
    });
    
    const explanationResponse = await explanationResult.response;
    const explanation = explanationResponse.text().trim();

    // Generate tags based on tone settings
    const tags = [
      getToneTag(cloneData.toneSettings.formality),
      getEmpathyTag(cloneData.toneSettings.empathy),
      getDirectnessTag(cloneData.toneSettings.directness),
      cloneData.toneSettings.length
    ];

    const isQuestion = query.toLowerCase().includes("?");
    const isMsgRequest = query.toLowerCase().includes("reply") || 
                         query.toLowerCase().includes("message") || 
                         query.toLowerCase().includes("respond");

    if (isQuestion) {
      tags.push("decision-support");
    } else if (isMsgRequest) {
      tags.push("auto-reply");
    }

    res.json({
      clone_reply: cloneReply,
      explanation: explanation,
      tags: tags,
    });

  } catch (error) {
    console.error("Error generating response with Gemini:", error);
    
    // Check if error is related to API key
    if (error.message && error.message.includes("API_KEY")) {
      console.error("API Key error detected. Please check your GEMINI_API_KEY in the .env file.");
      res.status(401).json({ 
        error: "Invalid or missing API key. Please check your GEMINI_API_KEY in the .env file.",
        details: error.message
      });
      return;
    }
    
    // Fallback to original mock response in case of error
    const fallbackResponse = generateMockResponse(query, cloneData);
    res.json(fallbackResponse);
  }
};

// Fallback function for when Gemini API fails
function generateMockResponse(query: string, cloneData: CloneData): CloneResponse {
  const lengthValue = cloneData.toneSettings.length;
  const formalityLevel = cloneData.toneSettings.formality;
  const empathyLevel = cloneData.toneSettings.empathy;
  const directnessLevel = cloneData.toneSettings.directness;

  const isQuestion = query.toLowerCase().includes("?");
  const isMsgRequest = query.toLowerCase().includes("reply") || 
                       query.toLowerCase().includes("message") || 
                       query.toLowerCase().includes("respond");

  let cloneReply = "";
  let explanation = "";
  const tags = [
    getToneTag(formalityLevel), 
    getEmpathyTag(empathyLevel), 
    getDirectnessTag(directnessLevel), 
    lengthValue
  ];

  if (isQuestion) {
    if (formalityLevel < 50) {
      cloneReply = `That's an interesting question! Based on how I usually think about things, I'd say ${generateThoughtfulAnswer(query)}`;
    } else {
      cloneReply = `Thank you for that thoughtful question. In my perspective, ${generateThoughtfulAnswer(query)}`;
    }
    explanation = `Provided a thoughtful answer aligned with ${cloneData.name}'s personality and decision-making style.`;
    tags.push("decision-support");
  } else if (isMsgRequest) {
    if (empathyLevel > 60) {
      cloneReply = `I really appreciate you reaching out about this. ${generateMessageReply(query)} Hope this helps!`;
    } else if (directnessLevel > 60) {
      cloneReply = `Here's my take: ${generateMessageReply(query)}`;
    } else {
      cloneReply = `Thanks for sharing. ${generateMessageReply(query)}`;
    }
    explanation = `Generated a response matching ${cloneData.name}'s typical communication style and tone preferences.`;
    tags.push("auto-reply");
  } else {
    cloneReply = `${generateThoughtfulAnswer(query)} That's something I'd definitely consider important.`;
    explanation = `Response reflects ${cloneData.name}'s values and thinking patterns based on their personality profile.`;
  }

  if (lengthValue === "short") {
    cloneReply = cloneReply.split(".")[0] + ".";
  }

  return {
    clone_reply: cloneReply,
    explanation,
    tags,
  };
}

function getToneTag(formality: number): string {
  if (formality < 33) return "casual";
  if (formality > 66) return "formal";
  return "balanced-tone";
}

function getEmpathyTag(empathy: number): string {
  if (empathy < 33) return "direct";
  if (empathy > 66) return "empathetic";
  return "balanced-empathy";
}

function getDirectnessTag(directness: number): string {
  if (directness < 33) return "subtle";
  if (directness > 66) return "straightforward";
  return "balanced-directness";
}

function generateThoughtfulAnswer(query: string): string {
  const answers = [
    "I think the key here is considering what really matters to me long-term",
    "that's something I'd approach by thinking about the core values at stake",
    "I'd focus on understanding the situation from multiple angles",
    "my instinct is to step back and think about what the best outcome would be",
    "I believe that depends on what we're really trying to achieve",
    "I'd probably want to explore all the angles before deciding",
  ];
  return answers[Math.floor(Math.random() * answers.length)];
}

function generateMessageReply(query: string): string {
  const replies = [
    "I think we're on the same page about this.",
    "that makes sense, and I appreciate your perspective.",
    "I've been thinking about this too, so I'm glad you brought it up.",
    "let me share what I've been thinking about it.",
    "I agree with where you're coming from.",
    "that's a fair point, and here's my take on it.",
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}