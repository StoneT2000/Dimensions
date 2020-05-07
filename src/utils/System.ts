/**
 * Various system related utilities
 */

import { spawnSync, spawn } from "child_process";

export const removeDirectorySync = (dir: string) => {
  spawnSync('find', [dir, '-exec', 'rm', '-rf', '{}', '+']);
}

export const removeDirectory = (dir: string) => {
  return new Promise((resolve, reject) => {
    let p = spawn('find', [dir, '-exec', 'rm', '-rf', '{}', '+']);
    p.on('error', (err) => {
      reject(err);
    })
    p.on('close', (code) => {
      if (code === 0) {
        resolve();
      }
      else {
        reject('exited with code ' + code);
      }
    })
  })
}