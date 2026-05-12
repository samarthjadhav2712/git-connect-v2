/**
 * agent.js
 *
 * AI agent using OpenAI SDK with a custom base URL
 * (compatible with any OpenAI-spec provider: Together, Groq, Ollama, etc.)
 *
 * Set in .env:
 *   OPENAI_API_KEY=your_key_here
 *   OPENAI_BASE_URL=https://your-provider-base-url/v1
 *   OPENAI_MODEL=gpt-4o   (or whatever model your provider supports)
 *
 * Run: node agent.js
 */

import OpenAI from "openai";
import dotenv from "dotenv";
import { toolDefinitions } from "./toolDefinitions.js";
import { executeTool } from "./toolExecutor.js";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL, // e.g. https://api.openai.com/v1 or custom
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

// --- UPDATED SYSTEM PROMPT ---
const SYSTEM_PROMPT = `You are a helpful academic assistant for GIT-Connect, a college student management system.
You can answer questions about students, their attendance, marks, courses, semester results, and upcoming exams.
When a user asks about a specific student, always fetch their profile first using their USN or name.
Be concise and friendly. Format numbers like attendance percentages to 2 decimal places.

IMPORTANT FORMATTING RULES:
- Always format your responses using Markdown.
- Use **bold text** for emphasis on important details like names, USNs, and exam names.
- Use bullet points for lists.
- Use Markdown tables when presenting structured data (like marks, attendance for multiple subjects, or timetables) to make it highly readable.`;

// Convert our tool definitions to OpenAI's function calling format
const openAITools = toolDefinitions.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

/**
 * Run a single query through the agent (agentic loop).
 * @param {string} userMessage
 * @returns {Promise<string>} Final assistant response
 */
export async function runAgent(userMessage) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  // Agentic loop: keep going until no more tool calls
  while (true) {
    const response = await client.chat.completions.create({
      model: MODEL,
      tools: openAITools,
      tool_choice: "auto",
      messages,
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const text = assistantMessage.content ?? "";
      return text;
    }

    const toolResults = await Promise.all(
      assistantMessage.tool_calls.map(async (toolCall) => {
        const { name, arguments: rawArgs } = toolCall.function;
        let args = {};
        try {
          args = JSON.parse(rawArgs);
        } catch {
          console.error(`Failed to parse args for tool ${name}:`, rawArgs);
        }

        console.log(`  → Calling tool: ${name}`, args);

        let content;
        try {
          const result = await executeTool(name, args);
          content = JSON.stringify(result ?? null);
        } catch (err) {
          content = JSON.stringify({ error: err.message });
        }

        return {
          role: "tool",
          tool_call_id: toolCall.id,
          content,
        };
      })
    );

    messages.push(...toolResults);
  }
}

// --- UPDATED BASE SYSTEM PROMPT ---
const BASE_SYSTEM_PROMPT = `You are a helpful academic assistant for GIT-Connect, a college student management system.
You can answer questions about students, their attendance, marks, courses, semester results, and upcoming exams.
Be concise and friendly. Format numbers like attendance percentages to 2 decimal places.

IMPORTANT FORMATTING RULES:
- Always format your responses using rich Markdown.
- Use **bold text** for emphasis.
- Use bullet points for lists.
- Use Markdown tables when presenting structured data (like subjects, marks, and attendance).

If you are not provided with a specific student's context below, you are in "General College Mode". In this mode, you can answer questions about courses, departments, events, and college info, but you MUST politely refuse to answer specific student data (attendance, marks, etc.) and ask the user to log in first.`;

export async function* runAgentStream(userMessage, chatHistory = [], studentContext = null) {
  let systemPrompt = BASE_SYSTEM_PROMPT;
  if (studentContext) {
    systemPrompt += `\n\n--- IMPORTANT CONTEXT ---\nYou have already been provided with the following student data from the database. This student is the child of the user. Use this to answer the user's query before using other tools:\n`;
    systemPrompt += JSON.stringify(studentContext, null, 2);
  }

  console.log("Initializing Agent Stream...");

  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory,
    { role: "user", content: userMessage },
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model: MODEL,
      tools: openAITools,
      tool_choice: "auto",
      messages,
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const finalAnswer = assistantMessage.content ?? "";
      yield { type: "final_answer", content: finalAnswer };
      break;
    }

    const parsedToolCalls = assistantMessage.tool_calls.map((toolCall) => {
      const { name, arguments: rawArgs } = toolCall.function;
      let args = {};
      try { args = JSON.parse(rawArgs); } 
      catch { console.error(`Failed to parse args for tool ${name}`); }
      
      return { id: toolCall.id, name, args };
    });

    for (const ptc of parsedToolCalls) {
      yield { type: "tool_call", tool: ptc.name, args: ptc.args };
    }

    const executedTools = await Promise.all(
      parsedToolCalls.map(async (ptc) => {
        let resultData;
        let content;
        try {
          resultData = await executeTool(ptc.name, ptc.args);
          content = JSON.stringify(resultData ?? null);
        } catch (err) {
          resultData = { error: err.message };
          content = JSON.stringify(resultData);
        }
        
        return {
          id: ptc.id,
          name: ptc.name,
          resultData,
          content
        };
      })
    );

    for (const ext of executedTools) {
      yield { type: "tool_result", tool: ext.name, result: ext.resultData };
      
      messages.push({
        role: "tool",
        tool_call_id: ext.id,
        content: ext.content,
      });
    }
  }
}