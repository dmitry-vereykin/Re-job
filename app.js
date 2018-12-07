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
    let user_emails = [];
    let organization_email = [];
    const similar = new SimilarSearch();
    var resume = [];
    var job = [];
    var result = [];

    // Resume
    async.parallel([
        function (parallel_done) {
            connection.query('select user_email from user',
                null, { useArray: true }, (err, rows) => {
                    if (err) return parallel_done(err);
                    for (var i = 0; i < rows.length; ++i) {
                        //console.log(i, rows[i]);
                        user_emails.push(rows[i]);
                    }
                    for (var iterator in user_emails) {
                        connection.query('select resume_chunk from entities_resume where user_email=?',
                            [user_emails[iterator]], { useArray: true }, (err, rows) => {
                                if (err) return parallel_done(err);
                                resume.push(rows.toString());
                                console.log("resume: ", resume);
                            });
                    }
                    parallel_done();
                });
        },

    // Job
        function (parallel_done) {
            connection.query('select organization_email from organization',
                null, { useArray: true }, (err, rows) => {
                    if (err) return parallel_done(err);
                    for (var i = 0; i < rows.length; ++i) {
                        //console.log(i, rows[i]);
                        organization_email.push(rows[i]);
                    }
                    for (var iterator in organization_email) {
                        connection.query('select job_chunk from entities_job where organization_email=?',
                            [organization_email[iterator]], { useArray: true }, (err, rows) => {
                                if (err) return parallel_done(err);
                                job.push(rows.toString());
                                console.log("job: ", job);
                            });
                    }
                    parallel_done();
                });
        },
    ], function (err, results) {
        if (err) console.log(err);
        console.log("resume-outside: ", resume);
        console.log("job-outside: ", job);

        var test = similar.getBestSubstring("iterator,2425325,4543,53", "iteratar,876842,534,4534");
        console.log(test.accuracy);

        for (var iterator in resume) {
            for (var iterator_2 in job) {
                console.log(similar.getBestSubstring("iterator", "iterator"));
            }
        }

        console.log(result);        
        connection.end();
        res.send();
    });
    res.render('index', {
        // Match algorithm(?)
    });
});

connection.end();

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
