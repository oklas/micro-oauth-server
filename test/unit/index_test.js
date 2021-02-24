
/**
 * Module dependencies.
 */

const MicroOAuthServer = require('../../');
const should = require('should');
const fetch = require('node-fetch');
const Request = require('oauth2-server').Request;
const Response = require('oauth2-server').Response;
const listen = require('test-listen');
const micro = require('micro')
const {createError, json, send, sendError} = micro;
const {getUrl} = require('../_test-utils')({micro, listen});
const request = require('supertest');
const sinon = require('sinon');
const Router = require('micro-ex-router');

/**
 * Test `MicroOAuthServer`.
 */

describe('MicroOAuthServer', function() {
 let app;

  beforeEach(function() {
    app = Router();
  });

  describe('authenticate()', function() {
    it('should call `authenticate()`', async function() {
      var oauth = new MicroOAuthServer({ model: {} });
      await sinon.stub(oauth.server, 'authenticate').resolves({});

      const url = await listen(micro(app.get('/', oauth.authenticate())));

      await request(url)
        .get('/');

      oauth.server.authenticate.callCount.should.equal(1);
      oauth.server.authenticate.firstCall.args.length.should.equal(2);
      oauth.server.authenticate.firstCall.args[0].should.be.an.instanceOf(Request);
      oauth.server.authenticate.restore();
    });
  });

  describe('authorize()', function() {
    it('should call `authorize()`', async function() {
      var oauth = new MicroOAuthServer({ model: {} });

      await sinon.stub(oauth.server, 'authorize').resolves({});

      const url = await listen(micro(app.get('/', oauth.authorize())));

      await request(url)
        .get('/');

      oauth.server.authorize.callCount.should.equal(1);
      oauth.server.authorize.firstCall.args.should.have.length(2);
      oauth.server.authorize.firstCall.args[0].should.be.an.instanceOf(Request);
      oauth.server.authorize.firstCall.args[1].should.be.an.instanceOf(Response);
      oauth.server.authorize.restore();
    });
  });

  describe('token()', function() {
    it('should call `token()`', async function() {
      var oauth = new MicroOAuthServer({ model: {} });

      await sinon.stub(oauth.server, 'token').resolves({});

      const url = await listen(micro(app.get('/', oauth.token())));

      await request(url)
        .get('/');

      oauth.server.token.callCount.should.equal(1);
      oauth.server.token.firstCall.args.should.have.length(2);
      oauth.server.token.firstCall.args[0].should.be.an.instanceOf(Request);
      oauth.server.token.firstCall.args[1].should.be.an.instanceOf(Response);
      oauth.server.token.restore();
    });
  });
});