# Micro OAuth Server [![Build Status](https://travis-ci.org/oklas/micro-oauth-server.png?branch=master)](https://travis-ci.org/oklas/micro-oauth-server)

Complete, compliant and well tested module for implementing an OAuth2 Server/Provider with [micro](https://github.com/vercel/micro) in [node.js](http://nodejs.org/).

This is the micro wrapper for [oauth2-server](https://github.com/thomseddon/node-oauth2-server).

## Installation

    $ npm install micro-oauth-server

## Quick Start

The module provides two middlewares - one for granting tokens and another to authorise them. `micro-oauth-server` and, consequently `oauth2-server`, expect the request body to be parsed already.

The following example uses `micro-ex-router` but you may opt for an alternative library.

```js
const Router = require('micro-ex-router')
const MicroOAuthServer = require('micro-oauth-server')

// Create a router for oauth.
var router = new Router()

app.oauth = new MicroOAuthServer({
  model: {}, // specification is here: https://oauth2-server.readthedocs.io/en/latest/model/spec.html
})

// options param is optional, docs: https://oauth2-server.readthedocs.io/en/latest/api/oauth2-server.html
const options = {}

app
  .use('/', app.oauth.authenticate(options))
  .use((req,res)=>send(res, 200, ''))
          
// Register `/token` POST path on oauth router (i.e. `/oauth2/token`).
app.post('/oauth2/token', app.oauth.token(options))

// export micro server.
module.exports = app
```

Then attempt to be granted a new oauth token:

```sh
curl -XPOST -d 'username=thomseddon&password=nightworld&grant_type=password&client_id=thom&client_secret=nightworld' http://localhost:3000/oauth2/token
```
