'use strict';

// Setup configuration (cli > env var > default)

var host, port;

const { Command } = require('commander');
const program = new Command();

program
  .name('fwst')
  .description('Fastify web server template')
  .version('1.0.0')
  .option('-h, --host <host>', 'host name / IP address to bind')
  .option('-p, --port <port>', 'port number to bind')
  ;

program.parse( process.argv );
const opts = program.opts();

host = opts.host || process.env.FWST_HOST || "localhost";
port = opts.port || process.env.FWST_PORT || "443";

const config = {
    server: {
        host: host,
        port: parseInt( port ),
        key_file: process.env.FWST_KEY_FILE || "./key.pem",
        cert_file: process.env.FWST_CERT_FILE || "./cert.pem",
        cors_origin: process.env.FWST_COR || ("https://" + host + ":" + port)
    },
    cookie: {
        secret: process.env.FWST_COOKIE_SECRET || "my-secret-12345",
        opts: {
            path: "/auth",
            secure: true,
            httpOnly: true,
            sameSite: "lax",
            maxAge: 3600
        }
    },
    token: {
        secret: process.env.FWST_TOKEN_SECRET || "Xh6-7puYwW-08TyF+67Sfd",
        expires: process.env.FWST_TOKEN_EXPIRE || "3600s"
    },
    oauth: {
        host: "auth.globus.org",
        client_id: "19e7a1e1-762b-4d56-8c41-cbef90afb82f",
        client_secret: "cIj5qu5q2HYV9yl2cGFdZPbLKUGAuDfYh05BzZAMGow=",
        authorizationUri: "https://auth.globus.org/v2/oauth2/authorize",
        accessTokenUri: "https://auth.globus.org/v2/oauth2/token",
        introspectPath: "/v2/oauth2/token/introspect",
        redirectUri: "https://"+host+":"+port+"/app/ui/auth",
        scopes: 'urn:globus:auth:scope:transfer.api.globus.org:all offline_access openid'
    }
}



module.exports = config;