/**
 * Various system related utilities
 */

import { spawn } from 'child_process';
import fs, { mkdirSync } from 'fs';
import path from 'path';
import rimraf from 'rimraf';

export const LOCAL_DIR = path.join(__dirname, '../../../../../local');

/**
 * Removes a file synchronously
 * @param file - file to remove
 */
export const removeFileSync = (file: string): void => {
  rimraf(file, (err) => {
    //
  });
  // spawnSync('rm', ['-f', file]);
};

/**
 * Removes a file
 * @param file - file to remove
 */
export const removeFile = (file: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    rimraf(file, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    // const p = spawn('rm', ['-f', file]);
    // p.on('error', (err) => {
    //   reject(err);
    // });
    // p.on('close', (code) => {
    //   if (code === 0) {
    //     resolve();
    //   } else {
    //     reject('exited with code ' + code);
    //   }
    // });
  });
};

export const processIsRunning = (pid: number): boolean => {
  try {
    // this actually returns a boolean, not sure why its not in @types/node
    return <boolean>(<unknown>process.kill(pid, 0));
  } catch (e) {
    return e.code === 'EPERM';
  }
};

/**
 * Removes files in the given directory synchronously
 * @param dir
 */
export const removeDirectorySync = (dir: string): void => {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  rimraf(dir, () => {});
};

/**
 * Removes files in the given directory
 * @param dir
 */
export const removeDirectory = (dir: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    rimraf(dir, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
  //   const p = spawn('find', [dir, '-exec', 'rm', '-rf', '{}', '+']);
  //   p.on('error', (err) => {
  //     reject(err);
  //   });
  //   p.on('close', (code) => {
  //     if (code === 0) {
  //       resolve();
  //     } else {
  //       reject(`removeDirectory on ${dir} exited with code ${code}`);
  //     }
  //   });
  // });
};

/**
 * Writes a file from given `file` path to `destination`. Auto creates directories as needed
 * @param file
 * @param destination
 */
export const writeFileToDestination = async (
  file: string,
  destination: string
): Promise<void> => {
  return new Promise((resolve) => {
    if (!fs.existsSync(path.dirname(destination))) {
      mkdirSync(path.dirname(destination), {
        recursive: true,
      });
    }
    fs.createReadStream(file)
      .pipe(fs.createWriteStream(destination))
      .on('close', () => {
        resolve();
      });
  });
};

/**
 * Effectively runs the `docker cp` command
 * @param fileOrDirectoryPath
 * @param container
 * @param targetPath
 */
export const dockerCopy = (
  fileOrDirectoryPath: string,
  containerID: string,
  targetPath: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const p = spawn('docker', [
      'cp',
      fileOrDirectoryPath,
      `${containerID}:${targetPath}`,
    ]);
    p.on('error', (err) => {
      reject(err);
    });
    p.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          `dockerCopy from ${fileOrDirectoryPath} to ${containerID}:${targetPath} exited with code ${code}`
        );
      }
    });
  });
};
