'use strict';

/*
Fastify based web server template with secure API

- Web application
    - Serves anonymous and secure application pages (/app/ui/... /auth/app/ui/...)
    - Uses ect templates to render pages
- API
    - Serves anonymous and secure API (/api/... /auth/api/...)
    - Uses OpenApi spec to validate endpoint parameters
    - Serves swagger UI (API documentation & test) at /api/doc
- Authentication
    - Uses Globus OAuth authentication
    - Log-in creates JWT token for use by web app (session cookie) or api (bearer token)
    - Allows token exchange from third party client / app using custom Globus scope
- Configuration
    - Params can be set via environment variables and/or command-line parameters

Access Token Expiration / Revocation

This template does not directly support access token expiration or revocation.
The current best practice is to set an expiration time for access tokens (stored
in the JWT) and issue a refresh token separately. When the token expires, the
refresh token can be used to get a new one. The refresh token must be stored in
a DB and can be invalidated, thus disabling the next refresh. However, this
still leaves an interval of time before expiration that a token can be used. To
close this gap, a server-side notification / cache system must be implemented
to blacklist revoked access tokens that have not yet expired. This is a fair
amount of work and, thus, not included here.

Custom Globus Scope

In order for the token exchange endpoint to work, a custom Globus scope must be
defined. This must be done via the Globus developer web site, and the scope must
be affiliated with the application hosting the API. Once a custom scope is
defined, third party apps may include this scope when users login with Globus and
later get an API token using the /api/token/exchange endpoint (with the third-
party token as a parameter).
*/


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

// For /auth paths, add an internal user ID ('uid') parameter to requests
// based on JWT in session cookie or auth header. Reject request otherwise.

app.decorateRequest( 'uid', '' );

app.addHook('onRequest', ( _req, _resp, _done ) => {
    console.log("onReq url",_req.raw.url);

    if ( _req.raw.url.startsWith("/auth")){
        console.log( "authenticate user" );

        if ( _req.cookies.session ){ // Check for JWT session cookie
            jwt.verify( _req.cookies.session, config.token.secret, ( err, user ) => {
                if ( err ){
                    return _resp.status(403).send({ message: "Invalid / expired session" });
                }

                _req.uid = user.uid;
                _done();
            });
        }else{ // Check for JWT authorization header
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
                _resp.status(401).send({ message: "Not Authenticated" });
            }
        }
    }else{
        _done();
    }
});

// ==================================== INPUT VALIDATION

inputVal.init('api_spec.yaml', {
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
        path: "./api_spec.yaml"
    },
    exposeRoute: true,
    routePrefix: "/api/doc",
    uiConfig:{
        docExpansion: "list",
        filter: true
    }
})

// ================================================================== Application

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
        // Can call this method with auth header - which doesn't make sense (client manages JWT)
        _resp.status(406).send({
            message: 'No active session.'
        });
    }
});

// ------------------------------------ UI Auth Methods

// TODO: generalize this code - should work with any ID provider

// Redirection endpoint from OAuth login
app.get( '/app/ui/auth', ( _req, _resp ) => {
    console.log( "/app/ui/auth from", _req.socket.remoteAddress );

    // Get client token
    oauth.code.getToken( _req.raw.url ).then( function( client_token ) {
        introspectToken( client_token.accessToken, function( userinfo ){
            var uid = userinfo.username.substr( 0, userinfo.username.indexOf( "@" ));

            console.log( "User", uid, "authenticated" );

            const jwt_token = genJWT({ uid: uid });
            _resp.setCookie('session', jwt_token, config.cookie.opts );

            // other stuff to save to DB
            // var token = client_token.data.other_tokens[0];
            //    userinfo.name;
            //    token.access_token;
            //    token.expires_in;
            //    token.refresh_token;

            _resp.redirect( "/auth/app/ui/main" );
        });
    }, function( reason ){
        console.log("Error: Oauth get token failed. Reason:", reason );
        _resp.redirect( "/app/ui/error" );
    });
});

// ================================================================== API

// ------------------------------------ Load OpenAPI route handlers
// Repeat for each API group

app.register( require( "./routes/api/user" ), { prefix: "/auth/api/user" });
app.register( require( "./routes/api/project" ), { prefix: "/auth/api/project" });


// ------------------------------------ Anonymous API Methods

// Exchange an external token (with API scope) for an API token
// Optional - could set session cookie
app.post( '/api/token/exchange', ( _req, _resp ) => {
    console.log("/api/token/exchange", _req.body );

    const token = _req.body.token;
    if ( token ){
        introspectToken( token, function( userinfo ){
            var uid = userinfo.username.substr( 0, userinfo.username.indexOf( "@" )),
                api_token = genJWT({ uid: uid });

            //_resp.setCookie('session', token, config.cookie.opts );
            _resp.send({ "token" : api_token });
        });
    }else{
        _resp.status(404).send("Missing token payload");
    }
});

// ------------------------------------ Authorized API Methods

// Get user ID from JWT
app.get( '/auth/api/who', ( _req, _resp ) => {
    _resp.send({ "uid" : _req.uid });
});

// Get return JWT from session cookie (can also get from browser storage)
app.get( '/auth/api/token/show', (_req, _resp) => {
    if ( _req.cookies.session ){
        _resp.send( _req.cookies.session );
    }else{
        _resp.status(406).send({
            message: 'No active session.'
        });
    }
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

function genJWT( _user ) {
    return jwt.sign( _user, config.token.secret, { expiresIn: config.token.expires });
}


// ==================================== SERVER

app.listen( config.server.port, config.server.host, err => {
    if (err) throw err;
    console.log('listening');
})
