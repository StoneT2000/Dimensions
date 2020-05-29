import mongoose from 'mongoose';
let Schema = mongoose.Schema;

let TournamentConfigSchema = new Schema({
  id:  { type: String, index: true, required: true, unique: true },
  configs: { type: Schema.Types.Mixed, required: true },
  status: { type: String, required: true },
  modificationDate: { type: Date, required: true },
}, { minimize: false });

export default TournamentConfigSchema;