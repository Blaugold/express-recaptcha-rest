'use strict'

/**
 * @fileoverview
 * @author Gabriel Terwesten
 * @copyright 2016 Gabriel Terwesten. All rights reserved.
 */

/**
 * =================================================================================================
 * Dependencies
 * =================================================================================================
 */

const chai = require('chai')
const sinonChai = require('sinon-chai')
const sinon = require('sinon')
chai.use(sinonChai)
const expect = chai.expect
const rewire = require('rewire')
const express = require('express')
const supertest = require('supertest')
const bodyparser = require('body-parser')

/**
 * =================================================================================================
 * Public
 * =================================================================================================
 */

describe('express-recaptcha-rest', function () {
  it('should skip verification if req.recaptcha is set to false', function (done) {
    const deps = {
      request: sinon.spy()
    }
    function preMW(req, res, next) {
      req.recaptcha = false
      next()
    }
    supertest(getApp(null, deps, preMW))
      .get('/')
      .expect(200)
      .expect(function () {
        expect(deps.request).to.not.have.been.called
      })
      .end(done)
  })

  it('should respond with 400 status if req has no recaptcha response', function (done) {
    supertest(getApp())
      .get('/')
      .expect(400)
      .end(done)
  })

  it('should look for recaptcha response in header first', function (done) {
    const reqSpy = sinon.spy(getResponseMock())
    const deps = { request: reqSpy }
    
    supertest(getApp(null, deps))
      .post('/?g-recaptcha-response=query')
      .set('g-recaptcha-response', 'header')
      .send({ 'g-recaptcha-response': 'body' })
      .expect(function () {
        expect(reqSpy).to.have.been.calledWithMatch('header')
      })
      .end(done)
  })

  it('should look for recaptcha response in query second', function (done) {
    const reqSpy = sinon.spy(getResponseMock())
    const deps = { request: reqSpy }

    supertest(getApp(null, deps))
      .post('/?g-recaptcha-response=query')
      .send({ 'g-recaptcha-response': 'body' })
      .expect(function () {
        expect(reqSpy).to.have.been.calledWithMatch('query')
      })
      .end(done)
  })

  it('should look for recaptcha response in body third', function (done) {
    const reqSpy = sinon.spy(getResponseMock())
    const deps = { request: reqSpy }

    supertest(getApp(null, deps))
      .post('/')
      .send({ 'g-recaptcha-response': 'body' })
      .expect(function () {
        expect(reqSpy).to.have.been.calledWithMatch('body')
      })
      .end(done)
  })
  
  it('should place verification response on req.recaptcha', function (done) {
    const deps = { request: getResponseMock(null, 200) }

    function postMw(req, res, next) {
      expect(req.recaptcha).to.eql({ success: true })
      next()
    }

    supertest(getApp(null, deps, null, postMw))
      .post('/')
      .send({ 'g-recaptcha-response': 'body' })
      .expect(200)
      .end(done)
  })

  it('should call next with error if verification request returns an error', function (done) {
    const deps = { request: getResponseMock(new Error('Some Error')) }

    supertest(getApp(null, deps))
      .post('/')
      .send({ 'g-recaptcha-response': 'body' })
      .expect(500)
      .expect(function (res) {
        expect(res.body.message).to.include('verification request failed')
      })
      .end(done)
  })

  it('should call next with error if status of verification request is not 200', function (done) {
    const body = JSON.stringify({ error: 'error '})
    const deps = { request: getResponseMock(null, 500, body) }

    supertest(getApp(null, deps))
      .post('/')
      .send({ 'g-recaptcha-response': 'body' })
      .expect(function (res) {
        const err = res.body
        expect(err.message).to.include('verification request returned status 500')
        expect(err.response.statusCode).to.equal(500)
        expect(err.response.body).to.eql(body)
      })
      .end(done)
  })

  it('should call next with error if body of verification request cant be parsed', function (done) {
    const deps = { request: getResponseMock(null, 200, 'not') }

    supertest(getApp(null, deps))
      .post('/')
      .send({ 'g-recaptcha-response': 'body' })
      .expect(function (res) {
        expect(res.body.message).to.include('parsing body of verification response failed')
      })
      .end(done)
  })

  it('should respond with 422 if recaptcha response is invalid', function (done) {
    const deps = { request: getResponseMock(null, 200,
      JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] })) }

    supertest(getApp(null, deps))
      .post('/')
      .send({ 'g-recaptcha-response': 'body' })
      .expect(422)
      .end(done)
  })

  it('should raise "bad verification request" if error because of bad request', function (done) {
    const body = { success: false, 'error-codes': ['missing-input-secret'] }
    const deps = { request: getResponseMock(null, 200, JSON.stringify(body)) }

    supertest(getApp(null, deps))
      .post('/')
      .send({ 'g-recaptcha-response': 'body' })
      .expect(function (res) {
        expect(res.body.message).to.include('bad verification request')
        expect(res.body.response).to.eql(body)
      })
      .end(done)
  })


  it('should use api test secret if options.secret is set to "test_secret"', function (done) {
    const deps = {
      request: sinon.spy(getResponseMock())
    }
    supertest(getApp(null, deps))
      .post('/')
      .send({ 'g-recaptcha-response': 'body' })
      .expect(200)
      .expect(function () {
        expect(deps.request).to.have.been.calledWithMatch('6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe')
      })
      .end(done)
  })

  it('should use api secret in options.secret', function (done) {
    const deps = {
      request: sinon.spy(getResponseMock())
    }
    supertest(getApp({ secret: 'mySecret' }, deps))
      .post('/')
      .send({ 'g-recaptcha-response': 'body' })
      .expect(200)
      .expect(function () {
        expect(deps.request).to.have.been.calledWithMatch('secret=mySecret')
      })
      .end(done)
  })
})

/**
 * =================================================================================================
 * Helpers
 * =================================================================================================
 */

/**
 * Set up test app
 * @param {object=} options - Options to pass to recaptcha middleware factory
 * @param {object=} dependencies - Dependencies to swap out inside module.
 * @param {function=} preMw - Middleware function to insert before recaptcha middleware.
 * @param {function=} postMw - Middleware function to insert before recaptcha middleware.
 * @returns {*}
 */
function getApp(options, dependencies, preMw, postMw) {
  options = options || { secret: 'test_secret' }
  dependencies = dependencies || {}
  preMw = preMw || noOpMw
  postMw = postMw || noOpMw

  const app = express()
  const recaptcha = rewire('../index')

  for (let key of Object.keys(dependencies)) {
    recaptcha.__set__(key, dependencies[key])
  }

  app.use(bodyparser.json())
  app.use(
    '/',
    preMw,
    recaptcha(options),
    postMw,
    okHandler
  )
  app.use(errHandler)
  return app
}

function noOpMw(req, res, next) {
  next()
}

function okHandler(req, res) {
  res.sendStatus(200)
}

function errHandler(err, req, res, next) {
  res.status(500).send(err)
}

function getResponseMock(err, statusCode, body) {
  return function (url, cb) {
    cb(err || null, { statusCode: statusCode || 200 }, body || JSON.stringify({ success: true }))
  }
}