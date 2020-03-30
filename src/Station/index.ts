import express from 'express';
import path from 'path';

export class Station {
  public app: express.Application;
  public static _id: number = 0;
  public id: number = 0;
  public name: string;
  constructor(name?: string) {
    this.app = express();
    this.app.use(express.static(path.join(__dirname, 'web/build')));
    this.app.get('/', function(req, res) {
      res.sendFile(path.join(__dirname, 'web/build', 'index.html'));
    });
    this.app.listen(9000);
    this.id = Station._id;
    this.name = `Station_${this.id}`;
    Station._id++;
    console.log(`Running ${this.name} at localhost:9000`);
  }
}