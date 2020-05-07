import express, { Request, Response, NextFunction } from 'express';
import * as error from '../error';
import formidable from 'formidable';
import extract from 'extract-zip';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { BOT_DIR } from '..';
import { genID } from '../../utils';
import { removeDirectory } from '../../utils/System';

export interface UploadData {
  file: string,
  name: string
}

/**
 * Returns path to unzipped bot contents and the main file.
 */
export const handleBotUpload = (req: Request): Promise<Array<UploadData>> => {
  return new Promise((resolve) => {
    //@ts-ignore
    const form = formidable({ multiples: true });
    form.parse(req, async (err, fields, files) => {
      if (err) {
        throw err;
      }
      console.log(files, fields);
      if (files.files === undefined) throw new error.BadRequest('No file(s) provided');
      if (fields.paths === undefined) throw new error.BadRequest('No file path(s) provided');
      if (!files.files.length) throw new error.BadRequest('No file(s) provided');
      fields.paths = JSON.parse(fields.paths);
      if (!fields.paths.length) throw new error.BadRequest('No file path(s) provided');

      if (fields.paths.length != files.files.length) throw new error.BadRequest('Paths and File arrays mismatch');

      let uploads = files.files;
      let paths = fields.paths;
      let names = fields.names;
      if (!names) names = [];

      let uploadProcessPromises: Array<Promise<UploadData>> = [];
      for (let i = 0; i < uploads.length; i++) {
        let upload = uploads[i];
        let pathToFile =  paths[i];
        let botName = names[i];
        uploadProcessPromises.push(processUpload(upload, pathToFile, botName));
      }
      let data = await Promise.all(uploadProcessPromises);
      resolve(data);
    });
  })
}

const processUpload = async (file: any, pathToFile: string, botName: string): Promise<UploadData> => {
  
  // generate a 18 char length nano ID to store this bot
  let id = genID(18);
      
  let botdir = BOT_DIR + '/bot-' + id;

  // extract first
  try {
    await extract(file.path, {
      dir: botdir
    });
  }
  catch (err) {
    throw new error.InternalServerError(err);
  }

  let pathToBotFile = path.join(botdir, pathToFile);
  let name = botName;

  // check if file exists
  if (!existsSync(pathToBotFile)) { 
    // remove folder if doesn't exist
    removeDirectory(botdir);
    throw new error.BadRequest(`Extracted zip file to bot-${id} but path to file ${pathToFile} does not exist in the extracted directory`);
  }
  else {
    return {
      name: name,
      file: pathToBotFile
    }
  }
}