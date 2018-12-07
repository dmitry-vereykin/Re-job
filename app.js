const express = require('express');
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');
const pdf2Text = require('pdf2text');
const app = express();
const port = 3000;
const Client = require('mariasql');
const parser = require('concepts-parser');
const fs = require('fs');
var async = require('async');
const { SimilarSearch } = require('node-nlp');
require('dotenv').config();

app.set('view engine', 'pug');
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());

var connection = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    multiStatements: true
});

fs.readFile('./sql/re-job.sql', 'utf8', function (err, data) {
    if (err) throw err;

    var sql = data.split(';')
        .filter((element) => {
            return element.length != 0
        })
        .map((element) => {
            if (element.length != 0)
                return element.replace(/\r?\n|\r/g, " ");
        });

    for (var iterator in sql) {
        connection.query(sql[iterator], (err, rows) => {
            if (err) throw err;
        });
    }
});

app.get('/', function (req, res) {
    res.render('index', {
    });
});

app.post('/resume', function (req, res) {
    let name = req.body.reName;
    let email = req.body.reEmail;
    let resumeFile = req.files.resumeFile;

    if (name === "" || email === "" || !(resumeFile)) {
        res.render('index', {
            error_resume: "Fill out all the fields and choose .pdf file."
        });
    } else if (!(/\.(pdf|pdf)$/i).test(resumeFile.name)) {
        // Modify regex if new file2text modules added
        res.render('index', {
            error_resume: "Only .pdf files are supported."
        });
    } else {
        pdf2Text(resumeFile.data).then(function (chunks, err) {
            var resumeString = chunks[0].join(' ');

            const concepts = parser.parse({ text: resumeString, lang: 'en' }, { mode: 'collect', filters: ['duplicate', 'invalid', 'partial', 'abbr', 'known'] });

            var resume = [];
            for (var id in concepts) {
                if (concepts[id]._fields.endsWithNumber !== true) {
                    resume.push(concepts[id]._fields.value);
                }
            }

            connection.query('insert ignore into user (user_email, user_name) values (?, ?)',
                [email, name], (err, rows) => {
                    if (err) throw err;
                });


            connection.query('delete from entities_resume where user_email = ?',
                [email], (err, rows) => {
                    if (err) throw err;
                });

            for (var iterator in resume) {
                connection.query('insert into entities_resume (user_email, resume_chunk) values (?, ?)',
                    [email, resume[iterator]], (err, rows) => {
                        if (err) throw err;
                    });
            }
        });

    }

    res.render('index', {

    });
});

app.post('/job', function (req, res) {
    let jobName = req.body.jobName;
    let email = req.body.jobEmail;
    let organizationName = req.body.organizationName;
    let jobFile = req.files.jobFile;

    if (jobName === "" || email === "" || organizationName === "" || !(jobFile)) {
        res.render('index', { error_job: "Fill out all the fields and choose .pdf file." });
    } else if (!(/\.(pdf|pdf)$/i).test(jobFile.name)) {
        // Modify regex if new file2text modules added
        res.render('index', {
            error_job: "Only .pdf files are supported."
        });
    } else {
        pdf2Text(jobFile.data).then(function (chunks, err) {
            var jobString = chunks[0].join(' ');

            const concepts = parser.parse({ text: jobString, lang: 'en' }, { mode: 'collect', filters: ['duplicate', 'invalid', 'partial', 'abbr', 'known'] });

            var job = [];
            for (var id in concepts) {
                if (concepts[id]._fields.endsWithNumber !== true) {
                    job.push(concepts[id]._fields.value);
                }
            }

            connection.query('insert ignore into organization (organization_email, organization_name) values (?, ?)',
                [email, organizationName], (err, rows) => {
                    if (err) throw err;
                });

            connection.query('insert ignore into jobs (organization_email, job_name) values (?, ?)',
                [email, jobName], (err, rows) => {
                    if (err) throw err;
                });

            connection.query('delete from entities_job where organization_email = ? and job_name = ?',
                [email, jobName], (err, rows) => {
                    if (err) throw err;
                });

            for (var iterator in job) {
                connection.query('insert into entities_job (organization_email, job_name, job_chunk) values (?, ?, ?)',
                    [email, jobName, job[iterator]], (err, rows) => {
                        if (err) throw err;
                    });
            }
        });
    }

    res.render('index', {

    });
});

app.post('/re-match', function (req, res) {
    let user_email = [];
    let organization_email = [];
    const similar = new SimilarSearch();
    var resume = [];
    var job = [];
    var jobName = [];
    var result = [];

    // Model 1
    // async.series([
    // function (callback) {
    //     connection.query('select job_chunk from entities_job where organization_email IN (select organization_email from organization)',
    //     null, {useArray: true }, (err, rows) => {
    //         if (err) throw err;
    //         job.push(rows.toString());
    //         //console.log("job: ", job);
    //         callback(null, 1);
    //     });
    // },
    // function (callback) {
    //     connection.query('select resume_chunk from entities_resume where user_email IN (select user_email from user)',
    //     null, {useArray: true }, (err, rows) => {
    //         if (err) throw err;
    //         resume.push(rows.toString());
    //         //console.log("resume: ", resume);
    //         callback(null, 2);
    //     });
    // },


    // Model 2
    // function (callback) {
    //     // Job
    //     connection.query('select organization_email from organization',
    //         null, { useArray: true }, (err, rows) => {
    //             if (err) throw err;
    //             for (var i = 0; i < rows.length; ++i) {
    //                 //console.log(i, rows[i]);
    //                 organization_email.push(rows[i].toString());
    //                 //callback(null, organization_email);
    //             }
    //             callback(null, organization_email);
    //             // console.log("organization_email: ", organization_email)
    //         });
    // },
    // function (callback) {
    //     for (var iterator in organization_email) {
    //         console.log("organization_email_iterator: ", iterator);
    //         connection.query('select ej.job_chunk from entities_job ej join organization o on o.organization_email=ej.organization_email;',
    //             [organization_email[iterator]], { useArray: true }, (err, rows) => {
    //                 if (err) throw err;
    //                 job.push(rows.toString());
    //                 // callback(null, job);
    //             });
    //             callback(null, job);
    //     }
    // },

    // function (callback) {
    //     // Resume
    //     connection.query('select user_email from user',
    //         null, { useArray: true }, (err, rows) => {
    //             if (err) throw err;
    //             for (var i = 0; i < rows.length; ++i) {
    //                 user_email.push(rows[i]);
    //                 // callback(null, user_email);
    //             }
    //             //callback(null, user_email);
    //         });
    // },
    // function (callback) {
    //     for (var iterator in user_email) {
    //         connection.query('select resume_chunk from entities_resume where user_email=?',
    //             [user_email[iterator]], { useArray: true }, (err, rows) => {
    //                 if (err) throw err;
    //                 resume.push(rows.toString());
    //                 // console.log("resume: ", resume);
    //                 // callback(null, resume);
    //             });
    //             callback(null, resume);
    //     }
    // },
    // ], function (err, results) {
    //     if (err) console.log(err);
    //     console.log("job-outside: ", job);
    //     console.log("resume-outside: ", resume);
    //     for (var iterator in resume) {
    //         for (var iterator_2 in job) {
    //             //console.log(resume[iterator], job[iterator_2]);
    //             result.push(similar.getBestSubstring(resume[iterator], job[iterator_2]));
    //             console.log("result: ", result);
    //         }
    //     }
    // });


    // Model 3
    async.series([
        function (callBack) {
            async.series([
                function (callback) {
                    connection.query('select user_email from user',
                        null, { useArray: true }, (err, rows) => {
                            if (err) throw err;
                            var str = rows.toString();
                            user_email = str.split(',');
                            console.log("user_email:", user_email);
                            callback(null, 1);
                        });
                },
            ], function (err, result) {
                var i = 0;
                user_email.forEach(function (data) {
                    connection.query('select resume_chunk from entities_resume where user_email=?',
                        [data], { useArray: true }, (err, rows) => {
                            if (err) throw err;
                            resume.push(rows.toString());
                            i++;
                            console.log("resume: ", resume);
                            console.log('i:' + i + ' user_email.length:' + user_email.length);
                            if (i === user_email.length) {
                                callBack(null, 1)
                            }
                        });
                });
            });
        },
        function (callBack) {
            async.series([
                function (callback) {
                    connection.query('select organization_email from organization',
                        null, { useArray: true }, (err, rows) => {
                            if (err) throw err;
                            var str = rows.toString();
                            organization_email = str.split(',');
                            console.log("organization_email:", organization_email);
                            callback(null, 1);
                        });
                },
                function (callback) {
                    connection.query('select job_name from jobs',
                        null, { useArray: true }, (err, rows) => {
                            if (err) throw err;
                            var str = rows.toString();
                            jobName = str.split(',');
                            console.log("job name:", jobName);
                            callback(null, 2);
                        });
                },
            ], function (err, result) {
                var i = 0;
                organization_email.forEach(function (data) {
                    connection.query('select job_chunk from entities_job where organization_email=?',
                        [data], { useArray: true }, (err, rows) => {
                            if (err) throw err;
                            job.push(rows.toString());
                            i++;
                            console.log("job: ", job);
                            console.log('i:' + i + ' organization_email.length:' + organization_email.length);
                            if (i === organization_email.length) {
                                callBack(null, 2)
                            }
                        });
                });
            });
        },
    ], function (err, results) {
        console.log("RESUME: ", resume);
        console.log("JOB: ", job);
        for (var iterator in resume) {
            for (var iterator_2 in job) {
                //console.log(resume[iterator], job[iterator_2]);
                var rate = similar.getBestSubstring(resume[iterator], job[iterator_2]);
                result.push(rate.accuracy);
                console.log("result: " + result);
                connection.query('insert ignore into `match` (user_email, organization_email, job_name, match_rate) values (?,?,?,?)',
                [user_email[iterator], organization_email[iterator_2], jobName[iterator_2], rate.accuracy], (err, rows) => {
                    if (err) throw err;
                });
            }
        }
    });

    var listResult = [];
    connection.query('select * from `match group by desc`', function(err, rows, fields) {
        if (err) {
            res.status(500).json({"status_code": 500, "status_message": "internal server error"});
        } else {
            for (var i = 0; i < 1; i++) {
                var match = {
                    'user':rows[i].user_email,
                    'organization':rows[i].organization_email,
                    'job':rows[i].job_name,
                    'rate':rows[i].match_rate
                }
                listResult.push(match);
            }
            res.render('index', {
                "listResult": listResult
            });
        }
    })
});

connection.end();

app.listen(port, () => console.log(`Example app listening on port ${port}!`));