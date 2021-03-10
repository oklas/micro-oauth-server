
/**
 * Module dependencies.
 */

var InvalidArgumentError = require('oauth2-server/lib/errors/invalid-argument-error');
var NodeOAuthServer = require('oauth2-server');
var Request = require('oauth2-server').Request;
var Response = require('oauth2-server').Response;
var UnauthorizedRequestError = require('oauth2-server/lib/errors/unauthorized-request-error');
var co = require('co');
var {send} = require('micro');

/**
 * Constructor.
 */

function MicroOAuthServer(options) {
  options = options || {};

  if (!options.model) {
    throw new InvalidArgumentError('Missing parameter: `model`');
  }

  for (var fn in options.model) {
    if(fn.match(/^_/)) continue;
    options.model[fn] = co.wrap(options.model[fn]);
  }

  this.server = new NodeOAuthServer(options);
}

/**
 * Authentication Middleware.
 *
 * Returns a middleware that will validate a token.
 *
 * (See: https://tools.ietf.org/html/rfc6749#section-7)
 */

MicroOAuthServer.prototype.authenticate = function() {
  var server = this.server;

  return async function(req, res) {
    var request = new Request(req);
    var response = new Response(res);

    try {
      if(!res.locals) res.locals = {}
      res.locals.oauth = {
        token: await server.authenticate(request, response)
      };
    } catch (e) {
      return handleError.call(this, e, req, res);
    }
  };
};

/**
 * Authorization Middleware.
 *
 * Returns a middleware that will authorize a client to request tokens.
 *
 * (See: https://tools.ietf.org/html/rfc6749#section-3.1)
 */

MicroOAuthServer.prototype.authorize = function() {
  var server = this.server;

  return async function(req, res) {
    var request = new Request(req);
    var response = new Response(res);

    try {
      if(!res.locals) res.locals = {}
      res.locals.oauth = {
        code: await server.authorize(request, response)
      };
      return handleResponse.call(this, req, res, response);
    } catch (e) {
      return handleError.call(this, e, req, res, response);
    }
  };
};

/**
 * Grant Middleware
 *
 * Returns middleware that will grant tokens to valid requests.
 *
 * (See: https://tools.ietf.org/html/rfc6749#section-3.2)
 */

MicroOAuthServer.prototype.token = function() {
  var server = this.server;

  return async function(req, res) {
    var request = new Request(req);
    var response = new Response(res);

    try {
      if(!res.locals) res.locals = {}
      res.locals.oauth = {
        token: await server.token(request, response)
      };

      handleResponse.call(this, req, res, response);
    } catch (e) {
      return handleError.call(this, e, req, res, response);
    }
  };
};

/**
 * Handle response.
 */

var handleResponse = function(req, res, response) {
  Object.keys(response.headers).forEach(k => res.setHeader(k, response.headers[k]) )
  return send(res, response.status, response.body);
};

/**
 * Handle error.
 */

var handleError = function(e, req, res, response) {
  if (response) {
    Object.keys(response.headers).forEach(k => res.setHeader(k, response.headers[k]) )
  }

  if (e instanceof UnauthorizedRequestError) {
    return send(res, e.code, '');
  }

  return send(res, e.code, { error: e.name, error_description: e.message });
};

/**
 * Export constructor.
 */

module.exports = MicroOAuthServer;
