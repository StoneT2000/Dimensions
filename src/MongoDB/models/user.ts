import mongoose from 'mongoose';
let Schema = mongoose.Schema;

import { MongoDB } from '..';
import { DeepPartial } from '../../utils/DeepPartial';
import { deepMerge } from '../../utils/DeepMerge';
import { deepCopy } from '../../utils/DeepCopy';
import { Player } from '../../Tournament';

const defaultUserSchemaOptions: MongoDB.UserSchemaOptions = {
  statistics: true,
  creationDate: true,
  playerID: true
}
const UserSchemaCreator = (options: DeepPartial<MongoDB.UserSchemaOptions> = {}) => {
  let schemaOptions: MongoDB.UserSchemaOptions = 
    deepMerge(deepCopy(defaultUserSchemaOptions), options);
  let schema = new Schema({
    username: { type: String, index: true, required: true, unique: true },
    passwordHash: { type: String, required: true }
  });

  // TODO: This can be more streamlined. Perhaps in the MatchSchemaCreator we also store the kind of type they should be
  if (schemaOptions.creationDate) {
    schema.add({
      creationDate: { type: Schema.Types.Date, default: Date.now }
    });
  }
  if (schemaOptions.statistics) {
    schema.add({
      statistics: { type: Schema.Types.Mixed }
    });
  }
  if (schemaOptions.playerID) {
    schema.add({
      playerID: { type: String, default: Player.generatePlayerID, index: true, unique: true }
    });
  }

  return schema;
};

export default UserSchemaCreator;