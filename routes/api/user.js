'use strict';

// API user methods

module.exports = (fastify, opts, done) => {
    fastify.get('/list', (_req, _rep) => {
        console.log("list users");
        _rep.send({ users: ['user-1','user-2'] });
    });

    fastify.get('/view', (_req, _rep) => {
        console.log("view user");
        _rep.send({ uid: 'user-1' });
    });

    done();
};

