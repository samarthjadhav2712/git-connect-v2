## 1. /api/chatbot/query    (POST)

- requires token in header. and the student ID must be in the body. 
- checks if the studentID is mapped to the user.
- returns makrdown respose, so that it can be rendered (tables and all)

### stream = true:
- input format:

    ```
    {
        "message": "describe my childs results",
        "history": [],
        "stream" : true,
        "studentId": 1
    }
    ```

- successful response in chuks:
    ```
        data: {"type":"metadata","studentContextIncluded":true}

        data: {"type":"tool_call","tool":"getStudentResults","args":{"usn":"2GI22CS001"}}

        data: {"type":"tool_result","tool":"getStudentResults","result":[{"semester":5,"sgpa":"8.55","cgpa":"8.55"}]}

        data: {"type":"final_answer","content":"Your child, Aarav Kumar, has results available for the current semester (5th semester):\n\n| Semester | SGPA | CGPA |\n|----------|------|------|\n| 5        | 8.55 | 8.55 |\n\n- SGPA (Semester Grade Point Average) for the 5th semester is **8.55**.\n- CGPA (Cumulative Grade Point Average) up to the 5th semester is also **8.55**.\n\nIf you want details for any other semester or subject-wise marks, please let me know!"}
    ```



### stream = false:
- req body
    ```
    {
        "message": "describe my childs results",
        "history": [],
        "stream" : false,
        "studentId": 1
    }
    ```

- response:
    ```
    {
        "success": true,
        "data": {
            "studentContextIncluded": true,
            "toolLogs": [
            {
                "action": "calling_tool",
                "tool": "getStudentResults",
                "args": {
                "usn": "2GI22CS001"
                }
            },
            {
                "action": "tool_completed",
                "tool": "getStudentResults",
                "result": [
                {
                    "semester": 5,
                    "sgpa": "8.55",
                    "cgpa": "8.55"
                }
                ]
            }
            ],
            "finalAnswer": "Your child's results for the current semester (Semester 5) are as follows:\n\n- **SGPA:** 8.55\n- **CGPA:** 8.55\n\nIf you want detailed marks for each subject in this semester or results from previous semesters, please let me know!"
        }
    }
    ```


### chat history format:
```
[
  {
    role: "user",
    content: "What is Rahul's attendance?"
  },
  {
    role: "assistant",
    content: "rahuls attendance is blah blah ................"
  }
]

```


### error types:
- token related error:
    - 401 token missing - { success: false, message: 'Access token required' }
    - 401 - { success: false, message: 'Invalid or expired token' }
    - 403 not user - { success: false, message: 'Forbidden: user token required' }

- 400 - { error: "Message is required."}
- 400 - { error:  "studentId is required for personalized queries." }
- 404 - {error: "Student profile not found."}
- 403 - {error: "Unauthorized: You do not have permission to access this student's data." }
- 500 insternal server error - { success: false, error: error.message }


## 2. /api/chatbot/query/guest (post)
dittoo same as /api/chatbot/query with 2 changes:
- 1. token verifiecation bypassed (not required)
-  2. studentID cannot be Ignored. (cannot fetch any student data.)

use for gues users, to answer related to courses and other data