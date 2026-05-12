/**
 * toolExecutor.js
 *
 * Central dispatcher. When the AI agent decides to call a tool,
 * pass the tool name and parsed arguments here.
 */

import * as studentTools from "./tools/studentTools.js";
import * as attendanceTools from "./tools/attendanceTools.js";
import * as courseTools from "./tools/courseTools.js";

// Import definitions so we know the correct parameter order
import { toolDefinitions } from "./toolDefinitions.js";

// Registry: maps exact tool name → function reference
const toolRegistry = {
  // Student
  getStudentByUSN: studentTools.getStudentByUSN,
  getStudentById: studentTools.getStudentById,
  searchStudentsByName: studentTools.searchStudentsByName,
  getStudentsByDepartment: studentTools.getStudentsByDepartment,
  getStudentsByBatchYear: studentTools.getStudentsByBatchYear,

  // Semester Results
  getStudentResults: studentTools.getStudentResults,
  getStudentResultBySemester: studentTools.getStudentResultBySemester,
  getStudentLatestCGPA: studentTools.getStudentLatestCGPA,

  // Enrolled Courses
  getCurrentEnrolledCourses: studentTools.getCurrentEnrolledCourses,
  getAllEnrolledCourses: studentTools.getAllEnrolledCourses,

  // Attendance
  getStudentAttendanceBySemester: attendanceTools.getStudentAttendanceBySemester,
  getStudentAttendanceForCourse: attendanceTools.getStudentAttendanceForCourse,
  getCoursesWithLowAttendance: attendanceTools.getCoursesWithLowAttendance,
  getOverallAttendance: attendanceTools.getOverallAttendance,

  // Courses
  getCourseByCode: courseTools.getCourseByCode,
  searchCoursesByName: courseTools.searchCoursesByName,
  getCoursesBySemesterAndBatch: courseTools.getCoursesBySemesterAndBatch,
  getCourseComponents: courseTools.getCourseComponents,

  // Marks
  getStudentMarksBySemester: courseTools.getStudentMarksBySemester,
  getStudentMarksByCourse: courseTools.getStudentMarksByCourse,
  getStudentMarksSummary: courseTools.getStudentMarksSummary,

  // Exams
  getStudentExams: courseTools.getStudentExams,
  getExamsByCourse: courseTools.getExamsByCourse,
  getUpcomingExams: courseTools.getUpcomingExams,
};

/**
 * Execute a tool call by name with the given arguments.
 * @param {string} toolName - The name of the tool
 * @param {object} args - Parsed arguments from the AI agent (keys may be in any order)
 * @returns {Promise<any>} The result of the tool function
 */
export async function executeTool(toolName, args = {}) {
  const fn = toolRegistry[toolName];

  if (!fn) {
    throw new Error(`Unknown tool: "${toolName}". Available tools: ${Object.keys(toolRegistry).join(", ")}`);
  }

  // Find the tool's schema to determine the correct argument order
  const toolSchema = toolDefinitions.find(t => t.name === toolName);
  let orderedArgs = [];

  if (toolSchema && toolSchema.parameters && toolSchema.parameters.properties) {
    // Object.keys() on the schema's properties guarantees the order matches
    // how we manually defined them in toolDefinitions.js
    const paramNames = Object.keys(toolSchema.parameters.properties);
    
    // Map the incoming un-ordered args object to the strictly ordered array
    orderedArgs = paramNames.map(paramName => args[paramName]);
  } else {
    // Fallback if a tool somehow has no parameters
    orderedArgs = [];
  }

  try {
    // Spread the strictly ordered arguments into the function
    const result = await fn(...orderedArgs);
    return result;
  } catch (error) {
    console.error(`Tool "${toolName}" failed:`, error.message);
    throw error;
  }
}

/**
 * List all available tool names.
 * @returns {string[]}
 */
export function listTools() {
  return Object.keys(toolRegistry);
}