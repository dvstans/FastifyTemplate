'use strict';

// API project methods

module.exports = (fastify, opts, done) => {
    fastify.get('/list', (_req, _rep) => {
        console.log("list users");
        _rep.send({ projects: ['proj-1','proj-2'] });
    });

    fastify.get('/view', (_req, _rep) => {
        console.log("view project");
        _rep.send({ pid: 'proj-1' });
    });

    done();
};

