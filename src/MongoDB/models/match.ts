import mongoose from 'mongoose';
import { MongoDB } from '..';
import { DeepPartial } from '../../utils/DeepPartial';
import { deepMerge } from '../../utils/DeepMerge';
let Schema = mongoose.Schema;
let ObjectId = mongoose.Schema.Types.ObjectId;
const defaultMatchSchemaOptions: MongoDB.MatchSchemaOptions = {
  state: false,
  results: true,
  creationDate: true
}
const MatchSchemaCreator = (options: DeepPartial<MongoDB.MatchSchemaOptions> = {}) => {
  let schemaOptions: MongoDB.MatchSchemaOptions = deepMerge(defaultMatchSchemaOptions, options);
  let schema = new Schema({
    name: String,
    id: ObjectId
  });
  if (schemaOptions.creationDate) {
    schema.add({
      creationDate: { type: Schema.Types.Date, default: Date.now }
    });
  }
  if (schemaOptions.results) {
    schema.add({
      results: Schema.Types.Mixed
    });
  }
  if (schemaOptions.state) {
    schema.add({
      state: Schema.Types.Mixed
    });
  }
  return schema;
};

const MatchSchema = new Schema({
  name: String,
  id: ObjectId,
  creationDate: { type: Schema.Types.Date, default: Date.now },
  results: Schema.Types.Mixed,
  state: Schema.Types.Mixed
});

export default MatchSchemaCreator;