/**
 * This file defines error classes based on their semantic meaning. It abstracts away
 * HTTP status codes so they can be used in a RESTful way without worrying about a
 * consistent error interface.
 *
 * These classes descend from the base Error class, so they also automatically capture
 * stack traces--useful for debugging.
 */

/**
 * Base error class.
 *
 * Supports HTTP status codes and a custom message.
 */
export class HttpError extends Error {
  public status;
  constructor(name, status, message?) {
    if (message === undefined) {
      message = status;
      status = name;
      name = undefined;
    }

    super(message);

    this.name = name || this.constructor.name;
    this.status = status;
    this.message = message;
  }
}

export class UserError extends HttpError {
  constructor(message) {
    super(200, message || 'User Error');
  }
}

export class BadRequest extends HttpError {
  constructor(message) {
    super(400, message || 'Bad Request');
  }
}

export class Unauthorized extends HttpError {
  constructor(message) {
    super(401, message || 'Unauthorized');
  }
}

export class Forbidden extends HttpError {
  constructor(message) {
    super(403, message || 'Permission denied');
  }
}

export class NotFound extends HttpError {
  constructor(message) {
    super(404, message || 'Resource not found');
  }
}

export class Unprocessable extends HttpError {
  constructor(message) {
    super(422, message || 'Unprocessable request');
  }
}

export class InternalServerError extends HttpError {
  constructor(message) {
    super(500, message || 'Internal server error');
  }
}

export class NotImplemented extends HttpError {
  constructor(message) {
    super(501, message || 'Not Implemented');
  }
}


/**
 * General error handling middleware. Attaches to Express so that throwing or calling next() with
 * an error ends up here and all errors are handled uniformly.
 */
export const errorHandler = (err, req, res, next) => {
  if (!err) err = new InternalServerError('An unknown error occurred');
  if (!err.status) err = new InternalServerError(err.message);
  console.error(err);
  res.status(err.status).json({
    error: {
      status: err.status,
      message: err.message,
    },
  });
};