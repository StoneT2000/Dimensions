import { Request } from 'express';
import * as error from '../error';
import formidable from 'formidable';
import extract from 'extract-zip';
import { existsSync } from 'fs';
import path from 'path';
import { BOT_DIR } from '..';
import { genID } from '../../utils';
import { removeDirectory } from '../../utils/System';
import { Database } from '../../Plugin/Database';

export interface UploadData {
  file: string;
  name: string;
  playerID: string;
  botdir: string;
  originalFile: string;
}

/**
 * Returns path to unzipped bot contents and the main file. If user provided, will only handle upload if user
 * matches playerID given
 */
export const handleBotUpload = (
  req: Request,
  user?: Database.PublicUser
): Promise<Array<UploadData>> => {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - this function is callable
    const form = formidable({ multiples: true });
    try {
      form.parse(req, async (err, fields, files) => {
        if (err) {
          throw err;
        }
        if (files.files === undefined)
          throw new error.BadRequest('No file(s) provided');
        if (fields.paths === undefined)
          throw new error.BadRequest('No file path(s) provided');
        if (!files.files.length) {
          files.files = [files.files];
        }
        fields.paths = JSON.parse(fields.paths);
        fields.names = JSON.parse(fields.names);
        fields.playerIDs = JSON.parse(fields.playerIDs);
        if (!fields.paths.length)
          throw new error.BadRequest('No file path(s) provided');

        if (fields.paths.length != files.files.length)
          throw new error.BadRequest('Paths and File arrays mismatch');

        const uploads = files.files;
        const paths = fields.paths;
        let names = fields.names;
        const playerIDs = fields.playerIDs;
        if (!names) names = [];

        const uploadProcessPromises: Array<Promise<UploadData>> = [];
        for (let i = 0; i < uploads.length; i++) {
          const upload = uploads[i];
          const pathToFile = paths[i];
          if (
            (<string>pathToFile).indexOf('/') !== -1 ||
            (<string>pathToFile).indexOf('\\') !== -1
          ) {
            reject(
              new error.BadRequest(
                'Path for file/directory cannot have / or \\ in them. File/directory must be in root directory after unzipping file'
              )
            );
            return;
          }

          const botName = names[i];
          const playerID = playerIDs[i];
          if (user) {
            // if differrent playerID and isn't admin, throw insufficient permissions
            if (
              user.playerID !== playerID &&
              !req.data.dimension.databasePlugin.isAdmin(user)
            ) {
              reject(
                new error.Unauthorized(
                  'Insufficient permissions to upload bot for this player ID'
                )
              );
              return;
            }
          }
          uploadProcessPromises.push(
            processUpload(upload, pathToFile, botName, playerID)
          );
        }
        Promise.all(uploadProcessPromises).then(resolve).catch(reject);
      });
    } catch (err) {
      reject(err);
    }
  });
};

const processUpload = async (
  file: any,
  pathToFile: string,
  botName: string,
  playerID: string
): Promise<UploadData> => {
  // generate a 18 char length nano ID to store this bot
  const id = genID(18);

  const botdir = BOT_DIR + '/bot-' + playerID + '-' + id;

  // extract first
  try {
    await extract(file.path, {
      dir: botdir,
    });
  } catch (err) {
    // clean up
    removeDirectory(botdir);
    throw new error.InternalServerError(err);
  }

  const pathToBotFile = path.join(botdir, pathToFile);
  const name = botName;

  // check if file exists
  if (!existsSync(pathToBotFile)) {
    // remove folder if doesn't exist
    removeDirectory(botdir);
    throw new error.BadRequest(
      `Extracted zip file to bot-${playerID}-${id} but path to file ${pathToFile} does not exist in the extracted directory`
    );
  } else {
    return {
      name: name,
      file: pathToBotFile,
      playerID: playerID,
      botdir: botdir,
      originalFile: file.path,
    };
  }
};
