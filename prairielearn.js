#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

var grading_queue = 'cs421_grading';
var result_queue = 'cs421_result';

var gid_counter = 1;

var gradingData = {
    "gid": null,                          // grading job ID
    "qInstance": {
        "qiid": "qi50342",                // question-instance ID
        "date": "2015-09-21T21:02:24Z",   // datetime when the question was generated
        "uid": "mwest@illinois.edu",      // student that is doing the question
        "qid": "fsmVerify",               // question ID (subdirectory name in the course questions/ directory)
        "vid": "2fs023qm",                // variant ID (base-48 encoded random number)
        "params": {"numLinks": 5, "inputString": "AAABBDBA"},   // parameters for the question (visible to students)
        "trueAnswer": {"testCase1": 45, "testCase2": "Empty"}   // true answer (hidden from students)
    },
    "submission": {
        "sid": "si3242",                  // submission ID
        "date": "2015-09-21T22:35:58Z",   // datetime when the student submitted this answer
        "type": null,                     // "check" or "score", whether to just check format/compile or to determine a score
        "submittedAnswer": {              // answer submitted by student that needs to be graded (format determined by question server.js)
            "answerFile": {
                "name": "printnumber.c",
                "encoding": "utf8",       // either "utf8" or "base64"
                "data": "#include <stdio.h>\nvoid main() {\n    printf(\"The answer is 42.\\n\");\n}\n"
            }
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

                console.log('PrairieLearn started, generating grading jobs...');
                ch.prefetch(5); // only process up to five messages simultaneously

                ch.consume(result_queue, function(msg) {
                    try {
                        var content = JSON.parse(msg.content.toString());
                        console.log('Recieved result for job ' + content.gid + ', score = ' + content.grading.score);
                    } catch (e) {
                        console.log('ERROR decoding msg', msg, e);
                    }
                    ch.ack(msg);
                });

                setInterval(function() {
                    gradingData.gid = "g" + gid_counter++;
                    gradingData.submission.type = (Math.random() < 0.5) ? 'check' : 'score';
                    console.log('Sending grading job ' + gradingData.gid + ' for ' + gradingData.submission.type);
                    ch.sendToQueue(grading_queue, new Buffer(JSON.stringify(gradingData)), {persistent: true});
                }, 1000);
            });
        });
    });
});
