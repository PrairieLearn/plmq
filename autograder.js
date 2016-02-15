#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

var grading_queue = 'cs421_grading';
var result_queue = 'cs421_result';

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
                        var content = JSON.parse(msg.content.toString());
                    } catch (e) {
                        console.log('ERROR decoding msg', msg, e);
                    }
                    var gid = content.gid;
                    console.log('######################################################################');
                    console.log('Received grading job ' + gid);
                    grade(content, function(err, result) {
                        if (err) {console.log(err); process.exit(1);}

                        console.log('Completed grading for job ' + gid + ', score: ' + result.score);
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
    console.log("File data:\n--------------\n" + gradingData.file_data + "--------------");
    var score = Math.floor(Math.random() * 100);
    callback(null, {score: score});
}
