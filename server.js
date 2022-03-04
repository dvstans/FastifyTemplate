'use strict';

const fastify = require('fastify');
const inputVal = require('openapi-validator-middleware');
const fs = require('fs');
const path = require('path');
const https = require('https');
const jwt = require('jsonwebtoken');
const oauth2_client = require('client-oauth2');
const config = require('./config.js');


const oauth = new oauth2_client({
    clientId: config.oauth.client_id,
    clientSecret: config.oauth.client_secret,
    authorizationUri: config.oauth.authorizationUri,
    accessTokenUri: config.oauth.accessTokenUri,
    redirectUri: config.oauth.redirectUri,
    scopes: config.oauth.scopes
});

// ==================================== INIT FASTIFY

const app = fastify({
    logger: true,
    https: {
        key: fs.readFileSync( config.server.key_file ),
        cert: fs.readFileSync( config.server.cert_file )
    }
});

// ==================================== SETUP APP SERVER
// Serve static templated web pages

app.register( require('fastify-static'), {
    root: path.join( __dirname, 'static')
});

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


app.register( require('fastify-cors'), {
    origin: config.server.cors_origin,
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true
});


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
                _done();
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
                    _done();
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

// ------------------------------------ UI Methods - ANONYMOUS

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

    _resp.redirect( oauth.code.getUri() );
});

// ------------------------------------ UI Methods - AUTHORIZED

app.get( '/auth/app/ui/main', ( _req, _resp ) => {
    console.log( "/auth/app/ui/main", _req.socket.remoteAddress );

    _resp.view('/views/main.ejs', { theme: "light", uid: _req.uid })
});

app.get( '/auth/app/ui/logout', (_req, _resp) => {
    console.log( "/auth/app/ui/logout", _req.socket.remoteAddress );

    if ( _req.cookies.session ){
        _resp.clearCookie('session', config.cookie.opts );

        _resp.redirect("https://auth.globus.org/v2/web/logout?redirect_name=Test Server&redirect_uri=https://sdms.ornl.gov:50100");
    }else{
        _resp.status(406).send({
            message: 'No active session.'
        });
    }
});

app.get( '/auth/app/api/token', (_req, _resp) => {
    console.log( "/auth/app/api/token", _req.socket.remoteAddress );

    if ( _req.cookies.session ){
        _resp.send( _req.cookies.session );
    }else{
        _resp.status(406).send({
            message: 'No active session.'
        });
    }
});


// ------------------------------------ UI Auth Methods

// TODO: generalize this code - should work with any ID provider

// Redirection endpoint from OAuth login
app.get( '/app/ui/auth', ( _req, _resp ) => {
    console.log( "/app/ui/auth", _req.socket.remoteAddress );

    // Get client token
    oauth.code.getToken( _req.raw.url ).then( function( client_token ) {
        var token = client_token.data.other_tokens[0];

        introspectToken( token, function( userinfo ){
            console.log("userinfo:",userinfo);

            var uid = userinfo.username.substr( 0, userinfo.username.indexOf( "@" ));

            console.log( "User", uid, "authenticated" );

            const user = {
                uid: uid
            };

            const jwt_token = genAccessToken( user );
            //console.log( "token", jwt_token );
            _resp.setCookie('session', jwt_token, config.cookie.opts );
            //console.log( "redirecting" );
            _resp.redirect( "/auth/app/ui/main" );
        });
/*
        const opts = {
            hostname: config.oauth.host,
            method: 'POST',
            path: config.oauth.introspectPath,
            rejectUnauthorized: true,
            auth: config.oauth.client_id + ":" + config.oauth.client_secret,
            headers:{
                'Content-Type' : 'application/x-www-form-urlencoded',
                'Accept' : 'application/json',
            }
        };

        // Request user info from token
        const req = https.request( opts, (res) => {
            var data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                var userinfo = JSON.parse( data ),
                    uid = userinfo.username.substr( 0, userinfo.username.indexOf( "@" ));

                console.log( "User", uid, "authenticated" );

                const user = {
                    uid: uid
                };

                // other stuff to save to DB
                //    userinfo.name;
                //    xfr_token.access_token;
                //    xfr_token.expires_in;
                //    xfr_token.refresh_token;

                const jwt_token = genAccessToken( user );
                //console.log( "token", jwt_token );
                _resp.setCookie('session', jwt_token, config.cookie.opts );
                //console.log( "redirecting" );
                _resp.redirect( "/auth/app/ui/main" );

            });
        });


        _req.on('error', (e) => {
            console.log("Error! User introspection failed, token:", token );
            _resp.redirect( "/app/ui/error" );
        });

        _req.write( 'token=' + client_token.accessToken + '&include=identities_set' );
        _req.end();
*/
    }, function( reason ){
        console.log("Error: Oauth get token failed. Reason:", reason );
        _resp.redirect( "/app/ui/error" );
    });
});

// ------------------------------------ API Methods

// TODO - What was this endpoint for? Takes an access token and generates a JWT

app.post( '/api/token', ( _req, _resp ) => {
    console.log("/api/token", _req.body );

    var token = _req.body.token;
    if ( token ){
        introspectToken( token, function( userinfo ){
            var uid = userinfo.username.substr( 0, userinfo.username.indexOf( "@" )),
                token = genAccessToken({ uid: uid });

            //console.log("set cookie",token);
            //_resp.setCookie('session', token, config.cookie.opts );
            _resp.send({ "token" : token });
        });
    }else{
        _resp.status(404).send("BAD");
    }
});

app.get('/user/list', (request, reply) => {
    console.log("list users");
    reply.send({ users: ['aaa','bbb'] });
});

app.get('/user/view', (request, reply) => {
    console.log("view user");
    reply.send({ id: 'aaa' });
});


// ==================================== SUPPORT FUNCTIONS

function introspectToken( _token, _cb ){
    const opts = {
        hostname: config.oauth.host,
        method: 'POST',
        path: config.oauth.introspectPath,
        rejectUnauthorized: true,
        auth: config.oauth.client_id + ":" + config.oauth.client_secret,
        headers:{
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept' : 'application/json',
        }
    };

    // Request user info from token
    const req = https.request( opts, (res) => {
        var data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            var userinfo = JSON.parse( data );
            _cb( userinfo );
        });
    });

    req.on('error', (e) => {
        console.log("Error! Token introspection failed:", e );
    });

    req.write( 'token=' + _token + '&include=identities_set' );
    req.end();
};

function genAccessToken( _user ) {
    return jwt.sign( _user, config.token.secret, { expiresIn: config.token.expires });
}


// ==================================== SERVER

app.listen( config.server.port, config.server.host, err => {
    if (err) throw err;
    console.log('listening');
})
