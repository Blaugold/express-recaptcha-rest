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

let request = require('request')
let Joi = require('joi')
let url = require('url')
let VError = require('verror')
let _ = require('lodash')

/**
 * =================================================================================================
 * Public
 * =================================================================================================
 */

const recaptchaUrl = 'https://www.google.com/recaptcha/api/siteverify'

const optionsSchema = Joi.object({
  field: Joi.string().default('g-recaptcha-response'),
  secret: Joi.string().required()
})

/**
 * Middleware factory.
 * @param {string} [options.field=g-recaptcha-response] - Key for recaptcha response to look for
 *                                                        in headers, query and body.
 * @param {string} options.secret - Secret to use in verification request. If set to "test_secret"
 *                                  uses secret for testing, which always makes the verification
 *                                  request succeed.
 * @returns {Function} - Middleware function.
 */
module.exports = function (options) {
  options = Joi.attempt(options, optionsSchema)
  options.url = recaptchaUrl
  
  if (options.secret === 'test_secret') {
    options.secret = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe'
  }

  return function (req, res, next) {
    if (req.recaptcha === false) {
      return next()
    }

    const recaptchaResponse = getRecaptchaResponse(options.field, req)

    if (!recaptchaResponse) {
      return res.status(400).send({
        status: 400,
        message: 'Request has to include recaptcha response.'
      })
    }

    request(getUri(
      options.url,
      options.secret,
      recaptchaResponse,
      req.ip
    ),
      function (err, verifyRes, body) {
        if (err) {
          const error = new VError(err, 'verification request failed')
          return next(error)
        }

        if (verifyRes.statusCode !== 200) {
          const error = new VError('verification request returned status %d', verifyRes.statusCode)
          error.response = { statusCode: verifyRes.statusCode, body: body }
          return next(error)
        }

        try {
          req.recaptcha = JSON.parse(body)
        } catch (e) {
          const error = new VError(e, 'parsing body of verification response failed')
          return next(error)
        }

        if (invalidRequest(req.recaptcha)) {
          const error = new VError('bad verification request')
          error.response = req.recaptcha
          return next(error)
        }

        if (invalidRecaptcha(req.recaptcha)) {
          return res.sendStatus(422)
        }

        next()
      }
    )
  }
}

/**
 * =================================================================================================
 * Helpers
 * =================================================================================================
 */

/**
 * Builds verification request uri.
 * @private
 * @param {string} serviceUrl - Url of verification service.
 * @param {string} secret - Recaptcha secret.
 * @param {string} response - Recaptcha response from client.
 * @param {string} remoteip - IP address of client
 * @returns {string} - Uri to verify recaptcha.
 */
function getUri(serviceUrl, secret, response, remoteip) {
  const urlObj = url.parse(serviceUrl)
  urlObj.query = {
    secret: secret,
    response: response,
    remoteip: remoteip
  }
  return url.format(urlObj)
}

/**
 * Gets recaptcha response from request.
 * @private
 * @param {string} field - Key to look for response.
 * @param {express.req} req - Request object.
 * @returns {string} - Recaptcha response.
 */
function getRecaptchaResponse(field, req) {
  return req.get(field) || (req.query && req.query[field]) || (req.body && req.body[field])
}

/**
 * Returns if recaptcha is invalid.
 * @private
 * @param {object} verificationRes - Body of verification response.
 * @returns {boolean}
 */
function invalidRecaptcha(verificationRes) {
  return !verificationRes.success &&
  _.includes(verificationRes['error-codes'], 'invalid-input-response')
}

/**
 * Returns if verification request is invalid.
 * @param {object} verificationRes - Body of verification response.
 * @returns {boolean}
 */
function invalidRequest(verificationRes) {
  return !verificationRes.success &&
    !_.includes(verificationRes['error-codes'], 'invalid-input-response')
}