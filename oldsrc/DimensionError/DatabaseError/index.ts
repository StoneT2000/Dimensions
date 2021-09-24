const DATABASE_ERROR = 'DatabaseError';
const DATABASE_GET_USER_ERROR = 'DatabaseGetUserError';
/**
 * Errors thrown that are related to databases
 */
export class DatabaseError extends Error {
  constructor(m: string) {
    super(m);
    this.name = DATABASE_ERROR;
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * Errors related to database getting users
 */
export class DatabaseGetUserError extends DatabaseError {
  constructor(m: string) {
    super(m);
    this.name = DATABASE_GET_USER_ERROR;
    Object.setPrototypeOf(this, DatabaseGetUserError.prototype);
  }
}
