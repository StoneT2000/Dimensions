import mongoose from 'mongoose';
const Schema = mongoose.Schema;

import { MongoDB } from '..';
import { DeepPartial } from '../../../utils/DeepPartial';
import { deepMerge } from '../../../utils/DeepMerge';
import { deepCopy } from '../../../utils/DeepCopy';
import { Player } from '../../../Tournament';

const defaultUserSchemaOptions: MongoDB.UserSchemaOptions = {
  creationDate: true,
};
const UserSchemaCreator = (
  options: DeepPartial<MongoDB.UserSchemaOptions> = {}
): mongoose.Schema<any> => {
  const schemaOptions: MongoDB.UserSchemaOptions = deepMerge(
    deepCopy(defaultUserSchemaOptions),
    options
  );

  const schema = new Schema(
    {
      username: { type: String, index: true, required: true, unique: true },
      passwordHash: { type: String, required: true },
      playerID: {
        type: String,
        default: Player.generatePlayerID,
        index: true,
        unique: true,
      },
      statistics: { type: Schema.Types.Mixed, default: {} },
      meta: {
        type: Schema.Types.Mixed,
        default: () => {
          return new Map();
        },
      },
    },
    { minimize: false }
  );

  // TODO: This can be more streamlined. Perhaps in the MatchSchemaCreator we also store the kind of type they should be
  if (schemaOptions.creationDate) {
    schema.add({
      creationDate: { type: Schema.Types.Date, default: Date.now },
    });
  }

  return schema;
};

export default UserSchemaCreator;
