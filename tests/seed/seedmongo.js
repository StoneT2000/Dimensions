const { Seeder } = require('mongo-seeding');
const path = require('path');
const config = {
  database: 'mongodb://root:rootpassword@localhost:27017/test?authSource=admin&readPreference=primary',
  dropDatabase: true,
};
const seeder = new Seeder(config);
const collections = seeder.readCollectionsFromPath("./tests/seed/data");
seeder
  .import(collections)
  .then(() => {
    // Do whatever you want after successful import
    console.log('Seeded DB');
  })
  .catch(err => {
    // Handle errors
    console.error(err);
  });