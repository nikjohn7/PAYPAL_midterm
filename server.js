const express = require('express')
const joi = require('joi')
var _ = require('lodash');
var data = require('./data/registeredUsers.json')

const app = express()
app.use(express.json())
app.use(express.urlencoded({extended: true}))


app.set('views', './views')
app.set('view engine', 'pug')

const portNumber = 8080

var user_details = data['user_details']

var course_details = {
    'PHY1001': {
        'desc': "Quantum Physics",
        'professors': ['raman', 'einstein'],
        'startDate': new Date("2020-02-01"),
        'duration': 3
    },
    'PHY1022': {
        'desc': "Kinematics",
        'professors': ['newton'],
        'startDate': new Date("2020-02-11"),
        'duration': 4
    },
    'CHY1011': {
        'desc': "Introduction to Physical Chemistry",
        'professors': ['niel','raman'],
        'startDate': new Date("2020-02-20"),
        'duration': 2
    },
    'MAT2022': {
        'desc': "Calculus in everyday lifey",
        'professors': ['newton'],
        'startDate': new Date("2020-02-20"),
        'duration': 2
    },
    'CSE2002': {
        'desc': "Computer Architecture",
        'professors': ['tim'],
        'startDate': new Date("2020-03-01"),
        'duration': 4
    }
}

var enrollments = {
    'PHY1001': { 'raman': ['mike', 'lucy'], 'einstein': ['peter', 'ravi','nick'] },
    'PHY1022': { 'newton': ['mike', 'peter','lucy']},
    'CHY1011': { 'niel': ['peter', 'joel'], 'raman': ['mike', 'roger']},
    'MAT2022': { 'newton': ['ravi', 'joel','peter','nick'] },
    'CSE2002': { 'tim': ['ravi', 'joel','peter','nick'] },
}


var sessions = {}

const auth_token_auth = joi.string().length(20).required()
const courseID_auth = joi.string().regex(/^[A-Z]{3}[0-9]{4}$/).required()


// Validators for request body input
const validators = {
    'authorized': {
        'auth_token': auth_token_auth
    },
    'login': {
        'username': joi.string().required(),
        'password': joi.string().required(),
        'nogui': joi.boolean()
    },
    'addUser': {
        'auth_token': auth_token_auth,
        'username': joi.string().required(),
        'name': joi.string().required(),
        'password': joi.string().required().min(4, 'utf8'),
        'level': joi.number().required(),
        'nogui': joi.boolean()
    },
    'delUser': {
        'auth_token': auth_token_auth,
        'userId': joi.string().required(),
        'nogui': joi.boolean()
    },
    'addCourse': {
        'auth_token': auth_token_auth,
        'courseID': courseID_auth,
        'description': joi.string().required(),
        'courseStartDate': joi.date().greater(Date.now()).required(),
        'courseTime': joi.number().required(),
        'nogui': joi.boolean()
    },
    'courseDetails': {
        'auth_token': auth_token_auth,
        'courseID': courseID_auth,
        'courseProfs': joi.string(),
        'prof': joi.string(),
        'nogui': joi.boolean()
    },
    'subscribeCourse': {
        'auth_token': auth_token_auth,
        'courseID': courseID_auth,
        'prof': joi.string().required(),
        'nogui': joi.boolean()
    }
}


// Utility Function - for validating request body
var validateRequest = function requestValidation(reqBody, validator) {
    const promise = new Promise(function (resolve, reject) {
        const result = joi.validate(reqBody, validators[validator])
        if (result.err) {
            return reject(result)
        }
        else {
            resolve(result)
        }
    })
    return promise
}

// Utility Function - for checking if record exists in data
var hasRecord = function findRecord(data, record) {
    const promise = new Promise(function (resolve, reject) {
        if (!(_.has(data, record))) {
            return reject()
        }
        else {
            resolve()
        }
    })
    return promise
}

// Utility Function - to generate Auth Token
function generateAuthToken() {
    return ((Math.random(0).toString(36).substr(2) + Math.random(0).toString(36).substr(2)).substr(0, 20))
}

// function to generate variables required for rendering home
function homeRenderData(current_user) {
    var details =  {
        'name' : user_details[current_user]['name'],
        'level' : user_details[current_user]['level']
    }

    // list of all courses, users
    var courseList = []
    var userList = []
    _.forIn(course_details, (course, courseID) => {
        courseList.push({
            'courseID': courseID,
            'description': course['desc'],
            'courseProfs': course['professors'],
            'startDate': course['startDate'],
            'courseTime': course['duration'],
            'enrollments': enrollments[courseID]
        })
    })

    _.forIn(user_details, (user, username) => {
        if (user['level'] == 1 || user['level'] == 0) {
            userList.push({
                'userId': username,
                'userName': user['name']
            })
        }
    })

    details['courseList'] = courseList
    details['userList'] = userList

    // list of all registered courses for a student
    if (details['level'] == 0) {
        var registeredCourses = []
        for (var courseID in enrollments) {
            _.forIn(enrollments[courseID], (students, professor) => {
                if (students.indexOf(current_user) != -1) {
                    registeredCourses.push({
                        'courseID': courseID,
                        'description': course_details[courseID]['desc'],
                        'courseProfs': course_details[courseID]['professors'],
                        'courseTime': course_details[courseID]['duration']
                    })
                }
            })
        }
        details['coursesenrolled'] = registeredCourses
    }

    // list of all courses a professor is teaching 
    if (details['level'] == 1) { 
        var registeredCourses = []
        _.forIn(course_details, (course, courseID) => {
            if (course['professors'].indexOf(current_user) != -1) {
                registeredCourses.push({
                    'courseID': courseID,
                    'description': course['desc'],
                    'courseProfs': course['professors'],
                    'courseTime': course['duration']
                })
            }
        })
        details['coursesenrolled'] = registeredCourses
    }
    return details
}

// Authenticated access middleware
app.use((req, res, next) => {
    // validate request body
    var auth_validator = joi.object(validators['authorized']).unknown() 
    const result = auth_validator.validate(req.body)

    // if validation fails (token was not provided)
    if (result.error) {
        // if seeking authentication, then allow access without token
        if (req.url === '/' || req.url === '/signup' || req.url === '/login') {
            return next()
        }
        return res.redirect('/')
    } else {
        // check if session with that token doesn't exist
        if (!(result.value.auth_token in sessions)) {
            return res.status(400).render('startup', {'message':"Session timed out"})
        } else {
            // All OK
            if(req.url === '/' || req.url === '/home') {
                    var current_user = sessions[result.value.auth_token]
                    var responseData = homeRenderData(current_user)
                    responseData['auth_token'] = result.value.auth_token
                    return res.render('home', responseData)
            }

            // allow access
            return next()
        }
    }
})

app.post('/login', (req, res) => {
    // validate request body
    validateRequest(req.body, 'login')
        .then((result) => {
            // check if username does not exists in DB
            hasRecord(user_details, result.username)
                .then(() => {
                    // check if password does not match
                    if (result.password !== user_details[result.username]['password']) {
                        res.status(400).render('startup', { 'message': "Please check your password" })
                    } else {
                        // All OK

                        var auth_token = generateAuthToken()
                        sessions[auth_token] = result.username
                        // response
                        var responseData = homeRenderData(result.username)
                        responseData['auth_token'] = auth_token
                        if (result.nogui) {
                            res.send(responseData)
                        }
                        else {
                            res.render('home', responseData)
                        }
                    }
                })
                .catch(() => {
                    res.status(400).render('startup', { 'message': "Username does not exist" })
                })
        })
        .catch((error) => {
            res.status(400).render('startup', { 'message': error.details[0].message })
        })
})

app.post('/addUser', (req, res) => {
    // validate request body
    validateRequest(req.body, 'addUser')
        .then((result) => {
            // check if username exists in DB (username must be unique)
            hasRecord(user_details, result.username)
                .then(() => {
                    //user exists - duplicate error
                    var responseData = homeRenderData(sessions[result.auth_token])
                    responseData['auth_token'] = result.auth_token
                    responseData['message'] = "Username already exists. Try logging in?"
                    if (result.nogui) {
                        res.send(responseData)
                    }
                    else {
                        res.render('home', responseData)
                    }
                },
                    () => {
                        // All OK 

                        // make a new user
                        user_details[result.username] = {
                            'name': result.name,
                            'password': result.password,
                            'level': result.level,
                        }
                        // response
                        var responseData = homeRenderData(sessions[result.auth_token])
                        responseData['auth_token'] = result.auth_token
                        responseData['message'] = "User added successfully"
                        if (result.nogui) {
                            res.send(responseData)
                        }
                        else {
                            res.render('home', responseData)
                        }
                    })
        })
        .catch((error) => {
            // if validations fail
            var responseData = homeRenderData(sessions[error._object.auth_token])
            responseData['auth_token'] = error._object.auth_token
            responseData['message'] = error.details[0].message
            if (error._object.nogui) {
                res.send(responseData)
            }
            else {
                res.render('home', responseData)
            }
        })
})


// app.post('/delUser', (req, res) => {
//     // validate request body
//     validateRequest(req.body, 'delUser')
//         .then((result) => {
//             // check if user exists in database
//             hasRecord(user_details, result.userId)
//                 .then(() => {
//                     // check if user is student / faculty
//                     if (user_details[sessions[result.auth_token]]['designation'] == 0 || user_details[sessions[result.auth_token]]['designation'] == 1) {
//                         var responseData = { 'message': "Oops! How did you land here? Your designation doesn't support this feature." }
//                         if (result.nogui) {
//                             res.send(responseData)
//                         }
//                         else {
//                             res.render('startup', responseData)
//                         }
//                     } else {
//                         // removing enrollments (if any)
//                         // if it is a faculty
//                         if (user_details[result.userId]['designation'] == 1) {
//                             _.forIn(enrollments, (faculties, courseID) => {
//                                 if (result.userId in faculties) {
//                                     // if this is the only faculty taking a course - Delete the course
//                                     if (course_details[courseID]['professors'].length == 1) {
//                                         delete faculties
//                                         delete course_details[courseID]
//                                     }
//                                     else {
//                                         // otherwise delete faculty from 'Registered Faculty' List of course
//                                         delete faculties[result.userId]
//                                     }
//                                 }
//                             })
//                         }
//                         // if it is a student
//                         else {
//                             _.forIn(enrollments, (faculties, courseID) => {
//                                 // removing all enrollments for the student
//                                 for (var professor in faculties) {
//                                     if (faculties[professor].indexOf(result.userId) != -1) {
//                                         enrollments[courseID][professor].splice(faculties[professor].indexOf(result.userId), 1)
//                                     }
//                                 }
//                             })
//                         }
//                         // deleting user
//                         delete user_details[result.userId]
//                         // response
//                         var responseData = homeRenderData(sessions[result.auth_token])
//                         responseData['auth_token'] = result.auth_token
//                         responseData['message'] = "Successfully deleted user account."
//                         if (result.nogui) {
//                             res.send(responseData)
//                         }
//                         else {
//                             res.render('home', responseData)
//                         }
//                     }
//                 })
//                 .catch(() => {
//                     // if user doesn't exist in database
//                     var responseData = homeRenderData(sessions[result.auth_token])
//                     responseData['auth_token'] = result.auth_token
//                     responseData['message'] = "User doesn't exist in the Database."
//                     if (result.nogui) {
//                         res.send(responseData)
//                     }
//                     else {
//                         res.render('home', responseData)
//                     }
//                 })
//         })
//         .catch((error) => {
//             // if validations fail
//             var responseData = homeRenderData(sessions[error._object.auth_token])
//             responseData['auth_token'] = error._object.auth_token
//             responseData['message'] = error.details[0].message
//             if (error._object.nogui) {
//                 res.send(responseData)
//             }
//             else {
//                 res.render('home', responseData)
//             }
//         })
// })

app.post('/logout', (req, res) => {
    // validate request body
    validateRequest(req.body, 'authorized')
        .then((result) => {
            // delete session
            delete sessions[result.auth_token]
            // response
            var responseData = {
                'message': "Logged out successfully"
            }
            if (result.nogui) {
                res.send(responseData)
            }
            else {
                res.render('startup', responseData)
            }
        })
        .catch(() => {
            res.render('startup', {'message': "Invalid"})
        })
})


app.post('/course', (req, res) => {
    // validate request body
    validateRequest(req.body, 'courseDetails')
        .then((result) => {
            // check if course code does not exist
            hasRecord(course_details, result.courseID)
                .then(() => {
                    // All OK
                    // preparing data for render/delivery
                    var responseData = {
                        'courseID': result.courseID,
                        'description': course_details[result.courseID]['desc'],
                        'courseStartDate': course_details[result.courseID]['startDate'],
                        'courseProfs': course_details[result.courseID]['professors'],
                        'courseTime': course_details[result.courseID]['duration'],
                        'courseBegan': new Date() > course_details[result.courseID]['startDate'],
                    }
                    // number of enrollments
                    var numberRegistered = 0
                    if (_.has(enrollments, result.courseID)) {
                        _.forIn(enrollments[result.courseID], (value, key) => {
                            numberRegistered += value.length
                        })
                    }

                    // object having registered students 
                    var registeredStudents = enrollments[result.courseID]

                    responseData['numberRegistered'] = numberRegistered
                    responseData['registeredStudents'] = registeredStudents

                    if (user_details[sessions[result.auth_token]]['level'] == 0) {
                        // check if student is enrolled in this course
                        responseData['enrolled'] = false
                        responseData['yourProf'] = "Not enrolled yet"
                        if (_.has(enrollments, result.courseID)) {
                            _.forIn(enrollments[result.courseID], (value, key) => {
                                if (value.indexOf(sessions[result.auth_token]) != -1) {
                                    responseData['enrolled'] = true
                                    responseData['yourProf'] = key
                                }
                            })
                        }
                    }

                    if (user_details[sessions[result.auth_token]]['level'] == 1) {
                        // check if faculty is registered with the course
                        responseData['registeredFaculty'] = false
                        if (_.has(course_details, result.courseID)) {
                            if (course_details[result.courseID]['professors'].indexOf(sessions[result.auth_token]) != -1) {
                                responseData['registeredFaculty'] = true
                            }
                        }
                    }
                    // add a current status of course
                    // if the course date has passed
                    if (responseData['courseBegan']) {
                        responseData['status'] = "Course has started."

                        // if student
                        if ('enrolled' in responseData) {
                            // if enrolled in course
                            if (responseData['enrolled']) {
                                responseData['status'] += " You are registered under this course. Make sure to keep up within the deadlines."
                            } else {
                                responseData['status'] = "Sorry! The "+responseData['status']+" and enrollments are closed"
                            }
                        }
                    } else {
                        responseData['status'] = "Course has not yet begun"
                        // if student
                        if ('enrolled' in responseData) {
                            // if enrolled in course
                            if (responseData['enrolled']) {
                                responseData['status'] = "You are enrolled in this course. "+responseData['enrolled']
                            } else {
                                responseData['status'] += ". You can register now"
                            }
                        } else {
                            responseData['status'] += " . You can register now"
                        }
                    }
                    responseData['auth_token'] = result.auth_token
                    responseData['level'] = user_details[sessions[result.auth_token]]['level']
                    if (result.nogui) {
                        res.send(responseData)
                    }
                    else {
                        res.render('course', responseData)
                    }
                })
                .catch(() => {
                    var responseData = homeRenderData(sessions[result.auth_token])
                    responseData['auth_token'] = result.auth_token
                    responseData['message'] = "Course Code invalid"
                    if (result.nogui) {
                        res.send(responseData)
                    }
                    else {
                        res.render('home', responseData)
                    }
                })         
        })
        .catch((error) => {
            var responseData = homeRenderData(sessions[error._object.auth_token])
            responseData['auth_token'] = error._object.auth_token
            responseData['message'] = "Please choose a valid option"
            if (error._object.nogui) {
                res.send(responseData)
            }
            else {
                res.render('home', responseData)
            }
        })   
})

app.post('/add', (req, res) => {
    // validate the request body
    const result = joi.validate(req.body, validators['addCourse'])
    validateRequest(req.body, 'addCourse')
        .then((result) => {
            if (user_details[sessions[result.auth_token]]['level'] == 0) {
                var responseData = homeRenderData(sessions[result.auth_token])
                responseData['auth_token'] = result.auth_token
                responseData['message'] = "Yikes! This feature is unsupported"
                if (result.nogui) {
                    res.send(responseData)
                }
                else {
                    res.render('home', responseData)
                }
            }
            else {
                // check if course code is in courses 
                hasRecord(course_details, result.courseID)
                    .then(() => {

                        if (course_details[result.courseID]['professors'].indexOf(sessions[result.auth_token]) != -1) {
                            var message = "Course Exists -- You are faculty for this course."
                        }
                        else {
                            course_details[result.courseID]['professors'].push(sessions[result.auth_token])
                            var message = "Course Exists -- Successful! You are now a Registered Faculty for the course."
                        }
                        var responseData = homeRenderData(sessions[result.auth_token])
                        responseData['auth_token'] = result.auth_token
                        responseData['message'] = message
                        if (result.nogui) {
                            res.send(responseData)
                        }
                        else {
                            res.render('home', responseData)
                        }
                    })
                    //otherwise
                    .catch(() => {
                        // adding course to course_details
                        course_details[result.courseID] = {
                            'desc': result.description,
                            'professors': [sessions[result.auth_token]],
                            'startDate': result.courseStartDate,
                            'duration': result.courseTime
                        }
                        var responseData = homeRenderData(sessions[result.auth_token])
                        responseData['auth_token'] = result.auth_token
                        responseData['message'] = "Course Added Successfully"
                        if (result.nogui) {
                            res.send(responseData)
                        }
                        else {
                            res.render('home', responseData)
                        }
                    })
            }
        })
        .catch((error) => {
            var responseData = homeRenderData(sessions[error._object.auth_token])
            responseData['auth_token'] = error._object.auth_token
            responseData['message'] = error.details[0].message
            if (error._object.nogui) {
                res.send(responseData)
            }
            else {
                res.render('home', responseData)
            }
        })
})

app.post('/delcourse', (req, res) => {
    // validate the request body
    validateRequest(req.body, 'courseDetails')
        .then((result) => {
            // check if course code does not exist in courses
            hasRecord(course_details, result.courseID)
                .then(() => {
                    // check if user is student
                    if (user_details[sessions[result.auth_token]]['level'] == 0) {
                        var responseData = { 'message': "Yikes. This feature is unsupported" }
                        res.render('startup', responseData)
                    } else {
                        // OK
                        if (course_details[result.courseID]['professors'].indexOf(sessions[result.auth_token]) == -1) {
                            var responseData = homeRenderData(sessions[result.auth_token])
                            responseData['auth_token'] = result.auth_token
                            responseData['message'] = "You don't have permission to delete this course as you are not a registered faculty for the course."
                            if (result.nogui) {
                                res.send(responseData)
                            }
                            else {
                                res.render('home', responseData)
                            }
                        }
                        else {
                            //if this is the only professor taking the course
                            if (course_details[result.courseID]['professors'].length == 1) {
                                //removing course
                                delete course_details[result.courseID]
                                //removing enrollments 
                                if (result.courseID in enrollments) {
                                    delete enrollments[result.courseID]
                                }
                                var message = "Course deleted successfully."
                            }
                            else {
                                //otherwise
                                //removing professor from list of professors taking the course
                                course_details[result.courseID]['professors'].splice(course_details[result.courseID]['professors'].indexOf(sessions[result.auth_token]), 1)
                                //removing enrollments for the professor
                                if (result.courseID in enrollments) {
                                    if (sessions[result.auth_token] in enrollments[result.courseID])
                                        delete enrollments[result.courseID][sessions[result.auth_token]]
                                }
                                var message = "You are no longer a faculty for this course"
                            }

                            var responseData = homeRenderData(sessions[result.auth_token])
                            responseData['auth_token'] = result.auth_token
                            responseData['message'] = message
                            if (result.nogui) {
                                res.send(responseData)
                            }
                            else {
                                res.render('home', responseData)
                            }
                        }
                    }
                })
                .catch(() => {
                    // course doesn't exist
                    var responseData = homeRenderData(sessions[result.auth_token])
                    responseData['auth_token'] = result.auth_token
                    responseData['message'] = "Course Code doesn't exist"
                    if (result.nogui) {
                        res.send(responseData)
                    }
                    else {
                        res.render('home', responseData)
                    }
                })
        })
        .catch(() => {
            var responseData = { 'message': "Please retry" }
            if (error._object.nogui) {
                res.send(responseData)
            }
            else {
                res.render('startup', responseData)
            }
        })
})

app.post('/teachcourse', (req, res) => {
    // validate the request body
    validateRequest(req.body, 'courseDetails')
        .then((result) => {
            if (user_details[sessions[result.auth_token]]['level'] == 0) {
                var responseData = { 'message': "Yikes! This feature is unsupported" }
                if (result.nogui) {
                    res.send(responseData)
                }
                else {
                    res.render('startup', responseData)
                }
            }
            else {
                // check if course code is in courses 
                if (result.courseID in course_details) {
                    // if professor is already in 'Registered Faculty' List
                    if (course_details[result.courseID]['professors'].indexOf(sessions[result.auth_token]) != -1) {
                        br
                        var message = "You already are a faculty for this course."
                    }
                    else {
                        // All OK
                        course_details[result.courseID]['professors'].push(sessions[result.auth_token])
                        var message = "Successful! You are now a faculty of this course"
                    }
                }
                else {
                    var message = "Course Doesn't Exist."
                }
                var responseData = homeRenderData(sessions[result.auth_token])
                responseData['auth_token'] = result.auth_token
                responseData['message'] = message
                if (result.nogui) {
                    res.send(responseData)
                }
                else {
                    res.render('home', responseData)
                }
            }
        })
        .catch((error) => {
            var responseData = { 'message': "Please retry" }
            if (error._object.nogui) {
                res.send(responseData)
            }
            else {
                res.render('startup', responseData)
            }
        })
})

app.post('/enroll', (req, res) => {
    // validate the request body
    const result = joi.validate(req.body, validators['courseDetails'])
    validateRequest(req.body, 'subscribeCourse')
        .then((result) => {
            // check if course code does not exist in courses
            hasRecord(course_details, result.courseID)
                .then(() => {
                    // check if user is admin
                    if (user_details[sessions[result.auth_token]]['level'] == 1) {
                        var responseData = { 'message': "Only students can enroll in courses" }
                        if (result.nogui) {
                            res.send(responseData)
                        }
                        else {
                            res.render('startup', responseData)
                        }
                    } else {
                        if (new Date() > course_details[result.courseCode]['startDate']) {
                            var message = "Sorry! You're too late. The course is already in progress."
                        } else {
                            // All OK

                            // if course exists in enrollments
                            if (result.courseID in enrollments) {
                                // adding student to enrollments
                                if (result.prof in enrollments[result.courseID]) {
                                    enrollments[result.courseID][result.prof].push(sessions[result.auth_token])
                                }
                                else {
                                    enrollments[result.courseID][result.prof] = [sessions[result.auth_token]]
                                }
                            } else {
                                // adding course and student to enrollments
                                enrollments[result.courseID] = {}
                                enrollments[result.courseID][result.prof] = [sessions[result.auth_token]]
                            }
                            var message = "Successfully enrolled in the course."
                        }
                        var responseData = homeRenderData(sessions[result.auth_token])
                        responseData['auth_token'] = result.auth_token
                        responseData['message'] = message
                        if (result.nogui) {
                            res.send(responseData)
                        }
                        else {
                            res.render('home', responseData)
                        }
                    }
                })
                .catch(() => {
                    // course doesn't exist
                    var responseData = homeRenderData(sessions[result.auth_token])
                    responseData['auth_token'] = result.auth_token
                    responseData['message'] = "Course Code doesn't exist"
                    if (result.nogui) {
                        res.send(responseData)
                    }
                    else {
                        res.render('home', responseData)
                    }
                })
        })
        .catch((error) => {
            var responseData = homeRenderData(sessions[error._object.auth_token])
            responseData['auth_token'] = error._object.auth_token
            responseData['message'] = "Please select a faculty before enrolling"
            if (error._object.nogui) {
                res.send(responseData)
            }
            else {
                res.render('home', responseData)
            }
        })
})

app.post('/dropcourse', (req, res) => {
    // validate the request body
    validateRequest(req.body, 'courseDetails')
        .then((result) => {
            // check if course code does not exist in courses
            if (!(result.courseID in course_details)) {
                var responseData = { 'message': "Course Code doesn't exist in the Database." }
                if (result.nogui) {
                    res.send(responseData)
                }
                else {
                    res.render('startup', responseData)
                }
            } else {
                // check if user is admin
                if (user_details[sessions[result.auth_token]]['level'] == 1) {
                    var responseData = { 'message': "Only students can drop courses" }
                    if (result.nogui) {
                        res.send(responseData)
                    }
                    else {
                        res.render('startup', responseData)
                    }
                } else {
                    // check if course has started
                    if (new Date() > course_details[result.courseID]['startDate']) {
                        var message = "Sorry, the course cannot be deleted as it is already in progress."
                    } else {
                        for (var professor in enrollments[result.courseID]) {
                            if (enrollments[result.courseID][professor].indexOf(sessions[result.auth_token]) != -1) {
                                break
                            }
                        }

                        // if only student in course under a professor
                        if (enrollments[result.courseID][professor].length == 1) {
                            // removing course and student from enrollments
                            delete enrollments[result.courseID][professor]
                        } else {
                            // removing student
                            enrollments[result.courseID][professor].splice(enrollments[result.courseID][professor].indexOf(sessions[result.auth_token]), 1)
                        }
                        var message = "Successfully dropped the course."
                    }
                    var responseData = homeRenderData(sessions[result.auth_token])
                    responseData['auth_token'] = result.auth_token
                    responseData['message'] = message
                    if (result.nogui) {
                        res.send(responseData)
                    }
                    else {
                        res.render('home', responseData)
                    }
                }
            }
        })
        .catch(() => {
            var responseData = { 'message': "Please retry" }
            if (error._object.nogui) {
                res.send(responseData)
            }
            else {
                res.render('startup', responseData)
            }
        })
})

app.get('/', (req, res) => {
        res.render('startup')
})

app.get('*', (req, res) => {
    res.redirect('/')
})

app.post('*', (req, res) => {
    res.status(404).send({ message: "URL not valid", 'Please try one of the following': ['/login', '/addUser', '/delUser', '/logout', '/course', '/add', '/delcourse', '/teachcourse', '/enroll', '/dropcourse']})
})

app.listen(portNumber)
console.log("Server listening on port", portNumber)
