import { runAgentStream } from "../ai/agent.js"
import { getStudentById } from "../ai/tools/studentTools.js";

export const get_answer = async (req, res) => {
  try {
    // 1. Extract stream boolean from req.body
    const { message, history, stream } = req.body;
    let { studentId } = req.body; // Changed to 'let' so we can nullify it if unauthenticated

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    let studentContext = null;

    // 2. Context & Authorization Check
    if (req.user?.mobile) {
      // SCENARIO A: User is logged in
      if (!studentId) {
        return res.status(400).json({ error: "studentId is required for personalized queries." });
      }

      // Fetch student details from DB
      studentContext = await getStudentById(studentId);

      if (!studentContext) {
        return res.status(404).json({ error: "Student profile not found." });
      }

      // Authorization check: Verify the student belongs to the logged-in user
      if (studentContext.mobile !== req.user.mobile) {
        return res.status(403).json({ 
          error: "Unauthorized: You do not have permission to access this student's data." 
        });
      }
    } else {
      // SCENARIO B: User is NOT logged in
      studentId = null;
      studentContext = null;
    }

    // Initialize the agent
    const agentStream = runAgentStream(message, history || [], studentContext);

    // ==========================================
    // 3A. STREAMING RESPONSE (Server-Sent Events)
    // ==========================================
    if (stream) {
      // Set headers required for Server-Sent Events (SSE)
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Optional: Send initial metadata about the connection context
      res.write(`data: ${JSON.stringify({ 
        type: "metadata", 
        studentContextIncluded: !!studentContext 
      })}\n\n`);

      // Consume the Async Generator and stream events immediately to the client
      for await (const event of agentStream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      // Close the connection when the generator is exhausted
      return res.end();
    } 
    
    // ==========================================
    // 3B. NORMAL (NON-STREAMING) RESPONSE
    // ==========================================
    else {
      // Arrays to collect intermediate data
      const toolLogs = [];
      let finalAnswer = "";

      // Consume the Async Generator completely before responding
      for await (const event of agentStream) {
        if (event.type === "tool_call") {
          toolLogs.push({ action: "calling_tool", tool: event.tool, args: event.args });
        } 
        else if (event.type === "tool_result") {
          toolLogs.push({ action: "tool_completed", tool: event.tool, result: event.result });
        } 
        else if (event.type === "final_answer") {
          finalAnswer = event.content;
        }
      }

      // Return the standard JSON response
      return res.json({
        success: true,
        data: {
          studentContextIncluded: !!studentContext, // True if personalized, False if general
          toolLogs: toolLogs,
          finalAnswer: finalAnswer,
        }
      });
    }

  } catch (error) {
    console.error("Error in chat endpoint:", error);
    
    // Safely handle errors if headers have already been sent (middle of a stream)
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
      return res.end();
    }

    // Standard error for non-streaming / pre-stream failures
    return res.status(500).json({ success: false, error: error.message });
  }
}