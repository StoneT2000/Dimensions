import mongoose from 'mongoose';
let Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: String,
  passwordHash: String,
  statistics: Schema.Types.Mixed,
  creationDate: { type: Date, default: Date.now },
  active: Boolean
});

export default UserSchema;