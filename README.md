# NOVISSIMO
### PayPal VAP 2020 Mid term project
A system developed using `Node.Js` and `Pug` for various colleges and universities to easy track and manage courses. 
The system has 3 levels, namely `admin`(level=2), `faculty`(level=1) and `student`(level=0) user types. The **admin** has power to  `createUser` and `delUser` . The **faculty** can `create` course, `teachcourse` , which allows them to teach a specific course, `delcourse` to stop teaching a course, or rmoving the course itself. The **student** can `enroll` and `drop` the courses. Necessary validations are performed and relevant messages are returned.


## Quick run

* Clone this GitHub repo to 'dir'
* Navigate to 'dir'
* Run `npm install` to install the dependencies
* Run `nodemon .\server.js`  to start a server instance of the project

## Pre-initialised Data

| username | password | level       |
|----------|----------|-------------|
| admin    | password | Admin       |
| raman    | prof     | Faculty     |
| einstein | prof     | Faculty     |
| tim      | prof     | Faculty     |
| newton   | prof     | Faculty     |
| niel     | prof     | Faculty     |
| mike     | abc      | Student     |
| lucy     | abc      | Student     |
| roger    | abc      | Student     |
| peter    | abc      | Student     |
| revi     | abc      | Student     |
| joel     | abc      | Student     |
| nick     | abc      | Student     |



## Class concepts used

* **express.js** - web app framework
*  **pug** - view engine
* **joi** - data validation 
*  **lodash** - utility functions
*  **promises**- just basic

### Three types of users: 
#### Admin (level = 2)
The `home` page for admin
* provides facility to `create` and `delete` **student**, **teacher** accounts. 
Inputs required to create a new user: `username`, `name`, `password`, `level`
Inputs required to delete user: `username`
* lists all courses (code, description, start date, duration in months, registrations under each faculty) 

#### Faculty (level = 1)
The `home` page for faculty
* provides facility to `create` a new course
  Inputs required: `courseID`, `courseName`, `startingDate`, `duration`. If the faculty tries to create a course with existing courseID, the faculty will be added to the list of instructors for that course.
 * lists **'My courses'** - courses for which the faculty is an instructor
 * lists **'All courses'** - all courses offered by the college

When  **'Get Details'** button is clicked, that specific  `course` page is opened.
The `course` page for faculty
*	lists course description, faculties taking the course, start date, status (has commenced?...), number of registrations, table of registrations (faculty: [students..])
*	provides facility to `delete` course if the faculty is a registered faculty for the course
	If this is the only registered faculty - the course record is deleted along with all registrations.
	Else - faculty is removed from the list of registered faculties along with all registrations under the faculty
* provides facility to `participate` in the course (i.e. join the registered faculty list) if the faculty is not a registered faculty for the course

#### Student (level = 0)
The `home` page for student
 * lists **'My courses'** - courses to which the student has subscribed
 * lists **'All courses'** - all courses offered by the university

When  **'Get Details'** button is clicked, that specific  `course` page is opened.
The `course` page for student
* lists course description, faculties taking the course, start date, status (has commenced?...), number of registrations, various faculties and students under them
* provides facility to `enroll`  the course provided the student is not already subscribed under any faculty AND the course has not commenced
Input required: `faculty` under which the student wishes to register in the specific `course`
* provides facility to `drop`  the course if the student is already subscribed and course hasn't begun

## Routes

`message` field in the response includes relevant messages.

- `/login`:  Starts a new session for the user and returns a token. 
	Required: `username`, `password`
    
- `/addUser`: Accessible only by admin. Creates a new user.
Required:  token, `username`,  `name`, `password`, `designation`
The token is used to determine the level of active user.
Returns relevant error messages if validation fails or username exists.
    
- `/course`:  Returns details (code, description, start date, duration in months, status, registrations under each faculty) for the requested course.
Required: token, `courseID`.
Returns relevant error messages if validation fails or course doesn't exist.
    
- `/add`:  Accessible only by faculty and admin (designation = 2). Adds a course to the database. 
Required: token,  `courseID`,  `courseDesc`,  `courseStartDate`, `courseDuration`.
If course code already exists, the faculty is added to the registered instructors list for the course and relevant message is returned.
Returns relevant error messages if validation fails.

- `/teachcourse`:  Accessible by faculty . Adds faculty to the registered instructors list for the course 
Required: token,  `courseID`
Returns relevant error messages if validation fails or course doesn't exist.
    
- `/delcourse`: Accessible only by registered faculty for the course. If this is the only registered faculty - the course record is deleted along with all registrations. Otherwise, faculty is removed from the list of registered faculties along with all registrations under the faculty.
Required: token,  `courseID`
Returns relevant error messages if validation fails or course doesn't exist.
    
- `/enroll`: Accessible only by student. Enrolls a student to a course. 
Required:  token, `courseID`
Returns relevant error messages if validation fails or the course start date has passed.
    
- `/dropcourse`: Accessible only by student . Drops a student from a course.
Required:  token, `courseID`
Returns relevant error messages if validation fails or the course start date has passed.

- `/logout`: Ends the session. 
Required: token

- `/`: Returns a list of all possible endpoints. 


