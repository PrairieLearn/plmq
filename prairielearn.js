#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

var gradingQueue = 'grading';
var resultQueue = 'result';

var gradingIdCounter = 1;


var gradingData = {
    "gradingId": null,                    // grading job ID (integer)

    "course": {
        "short_name": "TPL 101",
        "path": "exampleCourse",          // base directory of the course on disk
    },
    "question": {
        "directory":"fibonacciExternal",  // directory of question within <course-dir>/questions/
        "config":null,
    },
    "variant": {
        "variantSeed": "1r5dfy3",         // variant ID (base-48 encoded random number)
        "params": {"numLinks": 5, "inputString": "AAABBDBA"},   // parameters for the question (visible to students)
        "trueAnswer": {"testCase1": 45, "testCase2": "Empty"},  // true answer (hidden from students)
        "options":{},
    },
    "submission": {
        "submittedAnswer": {              // the answer that should be graded
            "code": "this is the wrong answer",
        },
        "type":"score",                   // "check" or "score", whether to just check format/compile or to determine a score
    },
};

amqp.connect('amqp://localhost?heartbeat=10', function(err, conn) {
    if (err) {console.log(err); process.exit(1);}
    conn.createChannel(function(err, ch) {
        ch.assertQueue(gradingQueue, {durable: true}, function(err, ok) {
            if (err) {console.log(err); process.exit(1);}
            ch.assertQueue(resultQueue, {durable: true}, function(err, ok) {
                if (err) {console.log(err); process.exit(1);}

                console.log('PrairieLearn started, generating grading jobs...');
                ch.prefetch(5); // only process up to five messages simultaneously

                ch.consume(resultQueue, function(msg) {
                    try {
                        var content = JSON.parse(msg.content.toString());
                        console.log('Recieved result for job ' + content.gradingId + ', score = ' + content.grading.score);
                    } catch (e) {
                        console.log('ERROR decoding msg', msg, e);
                    }
                    ch.ack(msg);
                });

                setInterval(function() {
                    gradingData.gradingId = gradingIdCounter++;
                    gradingData.submission.type = (Math.random() < 0.5) ? 'check' : 'score';
                    console.log('Sending grading job ' + gradingData.gradingId + ' for ' + gradingData.submission.type);
                    ch.sendToQueue(gradingQueue, new Buffer(JSON.stringify(gradingData)), {persistent: true});
                }, 1000);
            });
        });
    });
});
