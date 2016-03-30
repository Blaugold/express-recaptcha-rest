# express-recaptcha-rest
*Protect public routes from spam through recaptcha*

# About
The motivation behind this module was to protect an api endpoint, for
user signups from spam. Therefore this module does not deal with the
client side of recaptcha at all.

# Getting Started
Install the module with npm

```javascript
npm install -save express-recaptcha-rest
```

Once installed require it and add it as middleware to a route.

```javascript
const express = require('express')
const recaptcha = require('express-recaptcha-rest')

const app = express()

app.post('/some/route', recaptcha({ secret: 'your_secret' }), routeHandler)
```

# Options
- `field`
    - The name of the filed to look for the recaptcha response in the request
    - Per default it is set to 'g-recaptcha-response'
    - The middleware looks for the response in the following order: headers, query, body

- `secret`
    - The secret to use in the verification request
    - If set to 'test_secret' a fixed secret is used which will always make the verification request
    succeed. [Here](https://developers.google.com/recaptcha/docs/faq) are some more infos.

# Behaviour
Invalid recaptcha response
--------------------------
If the recaptcha response supplied by the client is invalid the 
middleware ends the response with a 422 status. Middleware and handlers
which are further down the line won't get executed.

No recaptcha response
---------------------
If the client does not send any recaptcha response at all or not under
the in options specified key the response will end with a
400 status.

Successful verification
-----------------------
The middleware adds a `req.recaptcha` property to the request.
This property holds the response from the verification request.

Skip verification
-----------------
If the middleware finds `req.recaptcha` set to false, by an early
middleware, verification will be skipped.

# errors
The following errors will be passed to next as the only argument.

verification request failed
---------------------------
This error indicates that the verification request could not be sent.

verification request returned status %d
---------------------------------------
Should the response to the verification request have any other status
than 200 this error is given.

parsing body of verification response failed
--------------------------------------------
If the JSON in the body of the response can not be parsed you will see
this error.

bad verification request
------------------------
This error shows that the request it self was invalid, most likely an
invalid recaptcha secret.