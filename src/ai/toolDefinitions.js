/**
 * toolDefinitions.js
 *
 * Defines the schema/metadata for each tool so they can be registered
 * with an AI agent (e.g. Claude, OpenAI function calling, LangChain, etc.)
 *
 * Note: The order of properties matches the positional arguments of the 
 * underlying functions to ensure exact mapping during execution.
 */

export const toolDefinitions = [
  // ───────────── STUDENT TOOLS ─────────────
  {
    name: "getStudentByUSN",
    description: "Fetch a student's full profile using their University Seat Number (USN). Returns name, department, batch year, current semester, scheme, and mobile.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string", description: "The student's USN, e.g. '1RV21CS001'" },
      },
      required: ["usn"],
    },
  },
  {
    name: "getStudentById",
    description: "Fetch a student's profile using their internal numeric student ID.",
    parameters: {
      type: "object",
      properties: {
        studentId: { type: "number", description: "The student's internal DB id" },
      },
      required: ["studentId"],
    },
  },
  {
    name: "searchStudentsByName",
    description: "Search for students by name (partial match). Returns a list of matching students.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Part or full name of the student" },
      },
      required: ["name"],
    },
  },
  {
    name: "getStudentsByDepartment",
    description: "Get all students in a specific department.",
    parameters: {
      type: "object",
      properties: {
        department: { type: "string", description: "Department name, e.g. 'Computer Science'" },
      },
      required: ["department"],
    },
  },
  {
    name: "getStudentsByBatchYear",
    description: "Get all students from a given batch/admission year.",
    parameters: {
      type: "object",
      properties: {
        batchYear: { type: "number", description: "The admission year, e.g. 2021" },
      },
      required: ["batchYear"],
    },
  },

  // ───────────── SEMESTER RESULTS ─────────────
  {
    name: "getStudentResults",
    description: "Get SGPA and CGPA for all semesters of a student using their USN.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
      },
      required: ["usn"],
    },
  },
  {
    name: "getStudentResultBySemester",
    description: "Get SGPA and CGPA for a student for a specific semester using their USN.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
        semester: { type: "number", description: "Semester number, e.g. 3" },
      },
      required: ["usn", "semester"],
    },
  },
  {
    name: "getStudentLatestCGPA",
    description: "Get the most recent CGPA and SGPA of a student using their USN.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
      },
      required: ["usn"],
    },
  },

  // ───────────── ENROLLED COURSES ─────────────
  {
    name: "getCurrentEnrolledCourses",
    description: "Get all courses a student is enrolled in for a given semester, using USN.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
        semester: { type: "number" },
      },
      required: ["usn", "semester"],
    },
  },
  {
    name: "getAllEnrolledCourses",
    description: "Get all courses a student has ever enrolled in across all semesters using USN.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
      },
      required: ["usn"],
    },
  },

  // ───────────── ATTENDANCE ─────────────
  {
    name: "getStudentAttendanceBySemester",
    description: "Get attendance (attended classes, total classes, percentage) for every course of a student in a semester.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
        semester: { type: "number" },
      },
      required: ["usn", "semester"],
    },
  },
  {
    name: "getStudentAttendanceForCourse",
    description: "Get attendance for a specific course of a student by USN and Course Code.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
        courseCode: { type: "string", description: "Course code, e.g. 'CS101'" },
        semester: { type: "number" },
      },
      required: ["usn", "courseCode", "semester"],
    },
  },
  {
    name: "getCoursesWithLowAttendance",
    description: "Get courses where the student's attendance is below a threshold. Useful for shortage warnings.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
        semester: { type: "number" },
        threshold: {
          type: "number",
          description: "Attendance percentage threshold. Default is 75.",
        },
      },
      required: ["usn", "semester"],
    },
  },
  {
    name: "getOverallAttendance",
    description: "Get the overall (aggregate) attendance percentage for a student in a semester.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
        semester: { type: "number" },
      },
      required: ["usn", "semester"],
    },
  },

  // ───────────── COURSES ─────────────
  {
    name: "getCourseByCode",
    description: "Fetch course details (name, type, credits, syllabus URL, summary) using the course code.",
    parameters: {
      type: "object",
      properties: {
        courseCode: { type: "string", description: "Course code, e.g. '21CS51'" },
      },
      required: ["courseCode"],
    },
  },
  {
    name: "searchCoursesByName",
    description: "Search for courses by name (partial match).",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "getCoursesBySemesterAndBatch",
    description: "Get all courses offered in a specific semester for a batch year.",
    parameters: {
      type: "object",
      properties: {
        semester: { type: "number" },
        batchYear: { type: "number" },
      },
      required: ["semester", "batchYear"],
    },
  },
  {
    name: "getCourseComponents",
    description: "Get all evaluation components for a course (e.g. Internal Assessment, End Exam) with max marks using the course code.",
    parameters: {
      type: "object",
      properties: {
        courseCode: { type: "string" },
      },
      required: ["courseCode"],
    },
  },

  // ───────────── MARKS ─────────────
  {
    name: "getStudentMarksBySemester",
    description: "Get all marks (per component per course) for a student in a semester.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
        semester: { type: "number" },
      },
      required: ["usn", "semester"],
    },
  },
  {
    name: "getStudentMarksByCourse",
    description: "Get marks for a specific student and a specific course code.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
        courseCode: { type: "string" },
      },
      required: ["usn", "courseCode"],
    },
  },
  {
    name: "getStudentMarksSummary",
    description: "Get total scored vs total max marks per course for a student in a semester.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
        semester: { type: "number" },
      },
      required: ["usn", "semester"],
    },
  },

  // ───────────── EXAMS ─────────────
  {
    name: "getStudentExams",
    description: "Get all scheduled exams (date, time, component name) for a student in a semester.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
        semester: { type: "number" },
      },
      required: ["usn", "semester"],
    },
  },
  {
    name: "getExamsByCourse",
    description: "Get all scheduled exams for a specific course code.",
    parameters: {
      type: "object",
      properties: {
        courseCode: { type: "string" },
      },
      required: ["courseCode"],
    },
  },
  {
    name: "getUpcomingExams",
    description: "Get exams scheduled from today onwards for a student in a semester.",
    parameters: {
      type: "object",
      properties: {
        usn: { type: "string" },
        semester: { type: "number" },
      },
      required: ["usn", "semester"],
    },
  },
];