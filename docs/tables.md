

# Database Schema Documentation

## 📌 Custom Data Types (Enums)
Based on the schema, the database utilizes the following custom enumerated types:
*   `department`: Represents academic departments (e.g., CSE, ECE, MECH).
*   `course_type_enum`: Represents the type of course.
*   `elective_type_enum`: Includes `professional`, `extra_curricular`, `open`, `core`.
*   `event_type_enum`: Categorizes calendar events (e.g., Holiday, Exam, Event).

---

## 1. Authentication & Users Domain

### `users`
Stores basic user information, likely used for mobile/OTP-based authentication.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier for the user. |
| mobile | `varchar(15)` | | Mobile number used for authentication/contact. |
| name | `varchar(100)`| | Full name of the user. |

### `admins`
Stores credentials for administrative access.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier for the admin. |
| username | `varchar(100)`| | Login username. |
| password_hash | `varchar(255)`| | Encrypted password. |

### `otp_store`
Temporary storage for OTPs generated for mobile authentication.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| mobile | `varchar(15)` | | Target mobile number for the OTP. |
| otp | `varchar(10)` | | The generated OTP. |
| expires_at| `timestamp` | | Expiration time of the OTP. |
| used | `boolean` | | Flag to check if OTP has been consumed. |

---

## 2. Student Information Domain

### `students`
Core academic profile for a student.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| user_id | `integer` | | *Logical link to `users.id` (Note: FK constraint missing).* |
| name | `varchar(100)`| | Full name of the student. |
| usn | `varchar(50)` | | University Seat Number / Roll Number. |
| current_sem| `smallint` | | The semester the student is currently in. |
| batch_year | `integer` | | The year the student joined (e.g., 2023). |
| department | `department`| | Enum: Student's branch of study. |
| scheme | `varchar(20)` | | Academic scheme (e.g., "2021 Scheme"). |

### `semester_results`
Stores the overall academic performance of a student per semester.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| student_id | `integer` | *FK* | References `students(id)`. |
| semester | `smallint` | | The semester number. |
| sgpa | `numeric(4,2)`| | Semester Grade Point Average. |
| cgpa | `numeric(4,2)`| | Cumulative Grade Point Average up to this semester. |

### `placements`
Aggregate placement statistics for a department in a specific academic year.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| academic_year| `varchar(20)`| **Unique** (w/ dept) | e.g., "2023-2024". |
| department | `varchar(100)`| **Unique** (w/ year) | Name of the department. |
| total_placed | `integer` | | Number of students placed. |
| avg_package_lpa| `numeric(6,2)`| | Average salary package in Lakhs Per Annum. |

---

## 3. Curriculum Domain (Courses & Subjects)

### `courses`
The master catalog of all subjects/courses offered by the institution.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| course_code| `varchar(50)` | **Unique** | Official course code (e.g., "CS101"). |
| name | `varchar(100)`| Not Null | Standard name of the course. |
| course_type| `course_type` | Not Null | Enum: Type of course. |
| elective_type| `elective_type`| Check | `professional`, `extra_curricular`, `open`, `core`. |
| syllabus_url| `varchar(255)`| | Link to the syllabus document. |
| summary | `text` | | Brief description of the course. |
| credits | `integer` | | Academic credits awarded. |
| department | `department` | | Department offering the course. |

### `course_translations`
Allows courses to have names and summaries in multiple languages (i18n).
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| course_id | `integer` | *FK*, **Unique**(w/ lang) | References `courses(id)`. |
| lang_code | `varchar(10)` | **Unique**(w/ course) | e.g., 'en', 'es', 'fr'. |
| name | `varchar(100)`| | Translated course name. |
| summary | `text` | | Translated summary. |

### `components`
Defines the types of assessments (e.g., "Internal Assessment", "Lab", "Final Theory").
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| comp_name | `varchar(100)`| | Name of the component. |

### `course_components`
Maps a specific course to its assessment components and sets the maximum marks.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| course_id | `integer` | *FK* | References `courses(id)`. |
| comp_id | `integer` | *FK* | References `components(id)`. |
| max_marks | `numeric(5,2)`| | Maximum marks achievable for this component. |

### `semester_courses`
Represents an instance of a course being offered in a specific semester for a specific batch.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| course_id | `integer` | *FK* | References `courses(id)`. |
| semester | `smallint` | | Semester in which it is offered. |
| batch_year | `integer` | | Target batch year. |

---

## 4. Enrollment, Attendance & Assessment Domain

### `student_courses`
Enrollment table linking students to the specific courses offered in a semester.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| student_id | `integer` | *FK* | References `students(id)`. |
| semester_course_id| `integer` | *FK* | References `semester_courses(id)`. |

### `attendance`
Tracks a student's attendance for a specific enrolled course.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| student_course_id| `integer` | *FK*, **Unique** | References `student_courses(id)`. (1-to-1 mapping) |
| attended_classes | `integer` | Default 0 | Number of classes the student attended. |
| total_classes | `integer` | Default 0 | Total number of classes held. |

### `marks`
Stores the marks obtained by a student for a specific component of a course.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| student_course_id| `integer` | *FK* | References `student_courses(id)`. |
| course_comp_id | `integer` | *FK* | References `course_components(id)`. |
| marks_scored | `numeric(5,2)`| | Marks achieved by the student. |

### `exams`
Schedules exams for specific course components.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| course_comp_id| `integer` | *FK* | References `course_components(id)`. |
| exam_date | `date` | | Date of the exam. |
| start_time | `time` | | Exam start time. |
| end_time | `time` | | Exam end time. |

---

## 5. Calendar & Events Domain

### `calendar_events`
The master table for all university/college events.
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| title | `varchar(200)`| | Event name/title. |
| event_date | `date` | | Date of the event. |
| event_type | `event_type` | | Enum: Categorizes the event. |

### `calendar_semesters`
Maps calendar events to specific semesters (e.g., Semester 1 Exams).
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| cal_id | `integer` | *FK*, Not Null | References `calendar_events(id)`. |
| semester | `smallint` | | Semester associated with the event. |

### `calendar_department`
Maps calendar events to specific departments (e.g., CSE Tech Fest).
| Column | Type | Modifiers | Description / Relationships |
| :--- | :--- | :--- | :--- |
| **id** | `integer` | **PK**, Auto-inc | Unique identifier. |
| cal_id | `integer` | *FK* | References `calendar_events(id)`. |
| department | `department` | | Enum: Department associated with the event. |
