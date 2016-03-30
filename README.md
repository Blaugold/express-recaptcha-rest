# express-recaptcha-rest

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