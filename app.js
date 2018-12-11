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

app.get('/', (req, res) => {
    res.render('index', {
    });
});

app.post('/resume', (req, res) => {
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

app.post('/job', (req, res) => {
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

function query(sql, args, options) {
    return new Promise((resolve, reject) => {
        connection.query(sql, args, options, (err, rows) => {
            if (err)
                return reject(err);
            resolve(rows);
        });
    });
}

function close() {
    return new Promise((resolve, reject) => {
        connection.end(err => {
            if (err)
                return reject(err);
            resolve();
        });
    });
}

app.post('/re-match', function (req, res) {
    var userEmails = [];
    const similar = new SimilarSearch();
    var rawResumes = [];
    var resumes = [];
    var jobNames = [];
    var rawJobs = [];
    var jobs = [];
    var results = [];

    query('use `re-job_db`', null)
        .then(() => {
            return query('select user_email from user', null, { useArray: true });
        })
        .then(rows => {
            userEmails = rows.toString().split(',');
            return Promise.all(userEmails.map((email) => {
                return query('select resume_chunk from entities_resume where user_email = ?', [email], { useArray: true });
            }));
        })
        .then(rows => {
            rows.forEach(resumeInChunks => {
                rawResumes.push(resumeInChunks.toString().replace(/,/g, ' '));
            });

            userEmails.forEach((email, i) => {
                resumes.push({ user_email: email, resume: rawResumes[i] })
            });

            console.log(resumes);

            return query('select organization_email, job_name from jobs', null, null);
        })
        .then(rows => {
            rows.forEach(jobOrganizationPair => {
                jobNames.push(jobOrganizationPair);
            });

            return Promise.all(jobNames.map((jobPair) => {
                return query('select job_chunk from entities_job where organization_email = ? and job_name = ?', [jobPair.organization_email, jobPair.job_name], { useArray: true });
            }));
        })
        .then(rows => {
            rows.forEach(jobInChunks => {
                rawJobs.push(jobInChunks.toString().replace(/,/g, ' '));
            });

            jobNames.forEach((jobPair, i) => {
                jobs.push({ organization_email: jobPair.organization_email, job_name: jobPair.job_name, job: rawJobs[i] })
            });

            // OUTPUT
            console.log(jobs);

            // SOMETHING IS BROKEN WITHIN THIS LOOP
            for (var i in resumes) {
                for (var j in jobs) {
                    var rate = similar.getBestSubstring(resumes[i].resume, jobs[j].job);
                    results.push({ user_email: resumes[i].user_email, organization_email: jobs[j].organization_email, job_name: jobs[j].job_name, rate: rate.accuracy });

                    // connection.query('insert ignore into `match` (user_email, organization_email, job_name, match_rate) values (?, ?, ?, ?)',
                    //     [resumes[i].user_email, jobs[j].organization_email, jobs[j].job_name, rate.accuracy], (err, rows) => {
                    //         if (err) throw err;
                    //     });
                }
            }

            // NO OUTPUT
            console.log(results);

            return close();
        }).then(() => {
            res.render('index', {

            });
        });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));