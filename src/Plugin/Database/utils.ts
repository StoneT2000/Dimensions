import { Database } from './index';
import jwt from 'jsonwebtoken';
require('dotenv').config();

/**
 * Generate a jwt for a user
 * @param user
 */
export function generateToken(user: Database.User) {
  const u = {
    username: user.username,
    playerID: user.playerID,
    creationDate: user.creationDate,
  };

  // Return the JWT Token
  return jwt.sign(u, process.env.JWT_SECRET, {
    expiresIn: 7 * 60 * 60 * 24, // expires in 1 week
  });
}

/**
 * Verify a jwt
 * @param token - the jwt to verify
 */
export async function verify(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      process.env.JWT_SECRET,
      (err: Error, user: Database.User) => {
        if (err) reject(err);
        resolve(user);
      }
    );
  });
}
