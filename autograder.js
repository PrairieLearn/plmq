#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

var grading_queue = 'cs421_grading';
var result_queue = 'cs421_result';

var resultData = {
    "gid": null,                          // grading job ID
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
                        console.log('ERROR decoding msg', msg, e);
                    }
                    var gid = gradingData.gid;
                    console.log('######################################################################');
                    console.log('Received grading job ' + gid + ' for ' + gradingData.submission.type);
                    grade(gradingData, function(err, result) {
                        if (err) {console.log(err); process.exit(1);}

                        console.log('Completed grading for job ' + gid);
                        result.gid = gid;
                        ch.sendToQueue(result_queue, new Buffer(JSON.stringify(result)), {persistent: true});
                        ch.ack(msg);
                    });
                });
            });
        });
    });
});

function grade(gradingData, callback) {
    console.log("File data:\n--------------\n" + gradingData.submission.submittedAnswer.fileData + "--------------");
    var ret = JSON.parse(JSON.stringify(resultData)); // clone resultData
    if (gradingData.submission.type == "check") {
        console.log("Doing compile check...");
    } else if (gradingData.submission.type == "score") {
        var score = Math.floor(Math.random() * 100);
        console.log("Computing question score = " + score);
        ret.grading.score = score;
    } else {
        console.log("ERROR: unknown submission.type: " + gradingData.submission.type);
    }
    callback(null, ret);
}
