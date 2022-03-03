'use strict';

const fastify = require('fastify');
const inputVal = require('openapi-validator-middleware');
const fs = require('fs');
const path = require('path');
const https = require('https');
const jwt = require('jsonwebtoken');

// ==================================== CONFIGURATION
// Load server configuration (cmd line > cfg file > env var)
const config = {
    cookie: {
        secret: "my-secret-12345",
        opts: {
            path: "/auth",
            secure: true,
            httpOnly: true,
            sameSite: "lax",
            maxAge: 3600
        }
    },
    token: {
        secret: "Xh6-7puYwW-08TyF+67Sfd",
        expire: "3600s"
    },
    server: {
        host: "localhost",
        port: 3000,
        key_file: "",
        cert_file: "",
        cors_origin: "http://localhost:3000"
    }
}

// ==================================== INIT FASTIFY

const app = fastify({
    logger: true,
    /*https: {
        key: fs.readFileSync( config.server.key_file ),
        cert: fs.readFileSync( config.server.cert_file )
    }*/
});

// ==================================== SETUP APP SERVER
// Serve static templated web pages

app.register( require('point-of-view'), {
    engine: {
        ejs: require('ejs')
    }
});


// ==================================== SETUP SECURITY
// Serve static templated web pages

app.register( require('fastify-cookie'), {
    secret: config.cookie.secret,
    parseOptions: {}
});

/*
app.register( require('fastify-cors'), {
    origin: config.cors_origin,
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true
});
*/

app.decorateRequest( 'uid', '' );


app.addHook('onRequest', ( _req, _resp, _done ) => {
    console.log("onReq url",_req.raw.url);

    if ( _req.raw.url.startsWith("/auth")){
        console.log( "authenticate user" );

        if ( _req.cookies.session ){
            jwt.verify( _req.cookies.session, config.token.secret, ( err, user ) => {
                if ( err ){
                    return _resp.status(403).send({ message: "Invalid / expired access token" });
                }

                _req.uid = user.uid;
                a_done();
            });
        }else{
            const authHeader = _req.headers['authorization']
            const token = authHeader && authHeader.split(' ')[1]

            if ( token ){
                jwt.verify( token, config.token.secret, ( err, user ) => {
                    if ( err ){
                        return _resp.status(403).send({ message: "Invalid / expired access token" });
                    }

                    _req.uid = user.uid;
                    a_done();
                });
            }else{
                console.log( "not authenticated" );

                _resp.status(401).send({ message: "Not Authenticated" });
            }
        }
    }else{
        _done();
    }
});

// ==================================== INPUT VALIDATION

inputVal.init('api.yaml', { 
    framework: 'fastify'
});

app.register(inputVal.validate({}));

app.setErrorHandler(async (err, req, reply) => {
    console.log("Error!",err);

    if (err instanceof inputVal.InputValidationError) {
        return reply.status(400).send({ more_info: JSON.stringify(err.errors) });
    }

    reply.status(500);
    reply.send();
});

// ==================================== SWAGGER UI
// Generates UI for test/documentation of API

app.register(require('fastify-swagger'), {
    mode: "static",
    specification: {
        path: "./api.yaml"
    },
    exposeRoute: true,
    routePrefix: "/test",
    uiConfig:{
        docExpansion: "list",
        filter: true
    }
})

// ==================================== ROUTES
// ---------------- UI Methods

app.get('/', ( _req, _rep ) => {
    console.log( "get /", _req.socket.remoteAddress );

    _rep.redirect( '/app/ui/welcome' );
});

app.get('/app/ui/welcome', ( _req, _rep ) => {
    console.log( "get /app/ui/welcome", _req.socket.remoteAddress );

    _rep.view('/views/welcome.ejs', { theme: "light" })
});

app.get( '/app/ui/login', (_req, _resp) => {
    console.log( "get /app/ui/login", _req.socket.remoteAddress );

    //_resp.redirect( g_globus_auth.code.getUri() );
});


app.get('/user/list', (request, reply) => {
    console.log("list users");
    reply.send({ users: ['aaa','bbb'] });
});

app.get('/user/view', (request, reply) => {
    console.log("view user");
    reply.send({ id: 'aaa' });
});

// ==================================== SERVER

app.listen( config.server.port, err => {
    if (err) throw err;
    console.log('listening');
})
