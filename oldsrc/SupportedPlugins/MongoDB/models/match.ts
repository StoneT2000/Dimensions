import mongoose from 'mongoose';
import { MongoDB } from '..';
import { DeepPartial } from '../../../utils/DeepPartial';
import { deepMerge } from '../../../utils/DeepMerge';
import { deepCopy } from '../../../utils/DeepCopy';
const Schema = mongoose.Schema;
const defaultMatchSchemaOptions: MongoDB.MatchSchemaOptions = {
  state: false,
  results: true,
  creationDate: true,
  finishDate: true,
  agents: true,
};
const MatchSchemaCreator = (
  options: DeepPartial<MongoDB.MatchSchemaOptions> = {}
): mongoose.Schema<any> => {
  const schemaOptions: MongoDB.MatchSchemaOptions = deepMerge(
    deepCopy(defaultMatchSchemaOptions),
    options
  );
  const schema = new Schema({
    name: String,
    id: { type: String, index: true, unique: true, required: true },
    governID: String,
    replayFile: { type: String, required: false },
    replayFileKey: { type: String, required: false },
  });

  // TODO: This can be more streamlined. Perhaps in the MatchSchemaCreator we also store the kind of type they should be
  if (schemaOptions.creationDate) {
    schema.add({
      creationDate: { type: Schema.Types.Date },
    });
  }
  if (schemaOptions.finishDate) {
    schema.add({
      finishDate: { type: Schema.Types.Date },
    });
  }
  if (schemaOptions.results) {
    schema.add({
      results: Schema.Types.Mixed,
    });
  }
  if (schemaOptions.state) {
    schema.add({
      state: Schema.Types.Mixed,
    });
  }
  if (schemaOptions.agents) {
    schema.add({
      agents: Schema.Types.Mixed,
    });
  }
  return schema;
};

export default MatchSchemaCreator;
