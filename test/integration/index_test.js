
/**
 * Module dependencies.
 */


const InvalidArgumentError = require('oauth2-server/lib/errors/invalid-argument-error');
const MicroOAuthServer = require('../../');
const NodeOAuthServer = require('oauth2-server');
const should = require('should');
const http = require('http');
const fetch = require('node-fetch');
const listen = require('test-listen');
const micro = require('micro');
const request = require('supertest');
const sinon = require('sinon');
const {createError, json, send, sendError} = micro;
const {getUrl} = require('../_test-utils')({micro, listen});
const Router = require('micro-ex-router');
const {resolve} = require('path');

/**
 * Test `MicroOAuthServer`.
 */

describe('MicroOAuthServer', function() {
  let app

  beforeEach(function() {
    app = Router();
  });

  describe('constructor()', function() {
    it('should throw an error if `model` is missing', function() {
      try {
        new MicroOAuthServer({});

        should.fail();
      } catch (e) {
        e.should.be.an.instanceOf(InvalidArgumentError);
        e.message.should.equal('Missing parameter: `model`');
      }
    });

    it('should wrap generator functions in the model', function() {
      var model = {
        getAccessToken: async function() {
          return 'foobar';
        }
      };

      new MicroOAuthServer({ model: model });

      model.getAccessToken().should.be.an.instanceOf(Promise);

      return model.getAccessToken()
        .then(function(data) {
          data.should.equal('foobar');
        })
        .catch(should.fail);
    });

    it('should set the `server`', function() {
      var oauth = new MicroOAuthServer({ model: {} });

      oauth.server.should.be.an.instanceOf(NodeOAuthServer);
    });
  });

  describe('authenticate()', function() {
    it('should return an error if `model` is empty', async () => {
      var oauth = new MicroOAuthServer({ model: {} });
      const url = await getUrl(app.get('/', oauth.authenticate()));
      return request(url)
        .get('/')
        .expect(500)
        .expect({
          error: 'invalid_argument',
          error_description: 'Invalid argument: model does not implement `getAccessToken()`'
        });
    });

    it('should authenticate the request', async function() {
      var tokenExpires = new Date();
      tokenExpires.setDate(tokenExpires.getDate() + 1);

      var token = { user: {}, accessTokenExpiresAt: tokenExpires };
      var model = {
        getAccessToken: function() {
          return token;
        }
      };
      var oauth = new MicroOAuthServer({model});

      const url = await getUrl(
        app
          .use('/', oauth.authenticate())
          .use((req,res)=>send(res, 200, ''))
      );

      request(url)
        .get('/')
        .set('Authorization', 'Bearer foobar')
        .expect(200);
    });

    it('should cache the authorization token', async function() {
      var tokenExpires = new Date()
      tokenExpires.setDate(tokenExpires.getDate() + 1);
      var token = { user: {}, accessTokenExpiresAt: tokenExpires };
      var model = {
        getAccessToken: function() {
          return token;
        }
      };
      var oauth = new MicroOAuthServer({ model });

      var spy = sinon.spy(async function(req, res) {
        res.locals.oauth.token.should.equal(token);
        send(res, 200, token);
      });

      const url = await getUrl(app.use('/', oauth.authenticate()).use(spy));

      request(url)
        .get('/')
        .set('Authorization', 'Bearer foobar')
        .expect(200, function(err, res) {
            spy.called.should.be.true;
            err ? reject(err) : resolve();
        });
    });    
  });

  describe('authorize()', function() {
    it('should cache the authorization code', async function() {
      var tokenExpires = new Date();
      tokenExpires.setDate(tokenExpires.getDate() + 1);

      var code = { authorizationCode: 123 };
      var model = {
        getAccessToken: function() {
          return { user: {}, accessTokenExpiresAt: tokenExpires };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com'] };
        },
        saveAuthorizationCode: function() {
          return code;
        }
      };
      var oauth = new MicroOAuthServer({ model, continueMiddleware: true });

      var spy = sinon.spy(async function(req, res) {
        const result = await oauth.authorize()(req, res)
        res.locals.oauth.code.should.equal(code);
        return result
      });
      const url = await getUrl(app.use(spy));

      return new Promise((resolve, reject) =>
        request(url)
          .post('/?state=foobiz')
          .set('Authorization', 'Bearer foobar')
          .send({client_id: 12345, response_type: 'code'})
          .expect(302, function(err, res){
              spy.called.should.be.true;
              err ? reject(err) : resolve()
          })
      )
    });

    it('should return an error', async function() {
      var model = {
        getAccessToken: function() {
          return { user: {}, accessTokenExpiresAt: new Date() };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com'] };
        },
        saveAuthorizationCode: function() {
          return { authorizationCode: 123 };
        }
      };
      var oauth = new MicroOAuthServer({ model });

      const url = await getUrl(app.use('/', oauth.authorize()));

      request(url)
        .post('/?state=foobiz')
        .set('Authorization', 'Bearer foobar')
        .send({ client_id: 12345 })
        .expect(400, {
          error: 'invalid_request', 
          error_description: 'Missing parameter: `response_type`'
        });
    });

    it('should return a `location` header with the error', async () => {
      var model = {
        getAccessToken: function() {
          return { user: {}, accessTokenExpiresAt: new Date() };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com'] };
        },
        saveAuthorizationCode: function() {
          return { };
        }
      };
      var oauth = new MicroOAuthServer({ model });

      const url = await getUrl(app.use('/', oauth.authorize()));

      request(url)
        .post('/?state=foobiz')
        .set('Authorization', 'Bearer foobar')
        .send({ client_id: 12345 })
        .expect('Location', 'http://example.com/?error=invalid_request&error_description=Missing%20parameter%3A%20%60response_type%60&state=foobiz')
    });

    it('should return a `location` header with the code', async function() {
      var model = {
        getAccessToken: function() {
          return { user: {}, accessTokenExpiresAt: new Date()  };
        },
        getClient: function() {
          return { grants: ['authorization_code'], redirectUris: ['http://example.com'] };
        },
        saveAuthorizationCode: function() {
          return { authorizationCode: 123 };
        }
      };
      var oauth = new MicroOAuthServer({ model });

      const url = await getUrl(app.use('/', oauth.authorize()));

      request(url)
        .post('/?state=foobiz')
        .set('Authorization', 'Bearer foobar')
        .send({ client_id: 12345, response_type: 'code' })
        .expect('Location', 'http://example.com/?code=123&state=foobiz')
    });

    it('should return an error if `model` is empty', async function() {
      var oauth = new MicroOAuthServer({ model: {} });

      const url = await getUrl(app.use('/', oauth.authorize()));

      request(url)
        .post('/')
        .expect({
          error: 'invalid_argument',
          error_description: 'Invalid argument: model does not implement `getClient()`'
        })
    });
  });

  describe('token()', function() {
    it('should return an `access_token`', async function() {
      var model = {
        getClient: function() {
          return { grants: ['password'] };
        },
        getUser: function() {
          return {};
        },
        saveToken: function() {
          return { accessToken: 'foobar', client: {}, user: {} };
        }
      };
      var oauth = new MicroOAuthServer({ model: model });

      const url = await getUrl(app.use('/', oauth.token()));

      request(url)
        .post('/')
        .send('client_id=foo&client_secret=bar&grant_type=password&username=qux&password=biz')
        .expect({ access_token: 'foobar', token_type: 'Bearer' });
    });

    it('should return a `refresh_token`', async function() {
      var model = {
        getClient: function() {
          return { grants: ['password'] };
        },
        getUser: function() {
          return {};
        },
        saveToken: function() {
          return { accessToken: 'foobar', client: {}, refreshToken: 'foobiz', user: {} };
        }
      };
      var oauth = new MicroOAuthServer({ model: model });

      const url = await getUrl(app.use('/', oauth.token()));

      request(url)
        .post('/')
        .send('client_id=foo&client_secret=bar&grant_type=password&username=qux&password=biz')
        .expect({ access_token: 'foobar', refresh_token: 'foobiz', token_type: 'Bearer' })
    });

    it('should return an error if `model` is empty', async function() {
      var oauth = new MicroOAuthServer({ model: {} });

      const url = await getUrl(app.use('/', oauth.token()));

      request(url)
        .post('/')
        .expect({
          error: 'invalid_argument',
          error_description: 'Invalid argument: model does not implement `getClient()`'
        });
    });
  });
});
