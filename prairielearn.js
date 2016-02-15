#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

var grading_queue = 'cs421_grading';
var result_queue = 'cs421_result';

var gid_counter = 1;

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
                        console.log('Recieved graded job ' + content.gid + ', score = ' + content.score);
                    } catch (e) {
                        console.log('ERROR decoding msg', msg, e);
                    }
                    ch.ack(msg);
                });

                setInterval(function() {
                    gid = gid_counter;
                    gid_counter++;
                    console.log('Sending grading job ' + gid);
                    job = {gid: gid};
                    ch.sendToQueue(grading_queue, new Buffer(JSON.stringify(job)));
                }, 1000);
            });
        });
    });
});
