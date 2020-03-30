import express from 'express';
import path from 'path';

export class Station {
  public app: express.Application;
  constructor() {
    this.app = express();
    this.app.use(express.static(path.join(__dirname, 'web/build')));
    this.app.get('/', function(req, res) {
      res.sendFile(path.join(__dirname, 'web/build', 'index.html'));
    });
    this.app.listen(9000);
    console.log("Running station at localhost:9000");
  }
}