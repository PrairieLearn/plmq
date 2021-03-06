#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

var grading_queue = 'grading';
var result_queue = 'result';

var resultData = {
    "gradingId": null,                    // grading job ID
    "grading": {
        "score": null,                    // score in [0, 1], or null if submission.type is "check"
        "feedback": {                     // feedback shown to student, format determined by server answer.html
            "compileErrors": "f.c: In function 'main':\nf.c:3:39: error: 'i' undeclared (first use in this function)\n",
            "testCases": [
                {number: 1, pass: true, result: "The answer is correct."},
                {number: 2, pass: false, result: "File size too large."}
            ]
        }
    }
};

amqp.connect('amqp://localhost?heartbeat=10', function(err, conn) {
    if (err) {console.log(err); process.exit(1);}
    conn.createChannel(function(err, ch) {
        ch.assertQueue(grading_queue, {durable: true}, function(err, ok) {
            if (err) {console.log(err); process.exit(1);}
            ch.assertQueue(result_queue, {durable: true}, function(err, ok) {
                if (err) {console.log(err); process.exit(1);}

                console.log('Autograder started, waiting for grading jobs...');
                ch.prefetch(1); // only process one grading job at a time

                ch.consume(grading_queue, function(msg) {
                    try {
                        var gradingData = JSON.parse(msg.content.toString());
                    } catch (e) {
                        return console.log('ERROR decoding msg', msg, e);
                    }
                    var gradingId = gradingData.gradingId;
                    console.log('######################################################################');
                    console.log('Received grading job ' + gradingId + ' for ' + gradingData.submissionType);
                    console.log('msg.content', msg.content.toString());
                    grade(gradingData, function(err, result) {
                        if (err) {console.log(err); process.exit(1);}

                        console.log('Completed grading for job ' + gradingId);
                        result.gradingId = gradingId;
                        ch.sendToQueue(result_queue, new Buffer(JSON.stringify(result)), {persistent: true});
                        ch.ack(msg);
                    });
                });
            });
        });
    });
});

function grade(gradingData, callback) {
    var ret = {
        gradingId: gradingData.gradingId,
        grading: {
            score: null,
        },
    };
    if (gradingData.submission.type == 'check') {
        ret.grading.feedback = 'This is some feedback';
    } else if (gradingData.submission.type == 'score') {
        if (/correct/.test(gradingData.submission.submittedAnswer.code)) {
            ret.grading.score = 1;
        } else {
            ret.grading.score = 0;
        }
    }
    callback(null, ret);
}
