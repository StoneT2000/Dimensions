import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import 'mocha';
import { ELOSystem } from '../../../src/Tournament/ELO';
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

describe('Test ELO System', () => {
  it('should initialize ELO ratings correctly', () => {
    let elo = new ELOSystem(32, 1000);
    let p1 = elo.createRating();
    let p2 = elo.createRating();
    expect(p1.score).to.equal(1000);
    expect(p2.score).to.equal(1000);
    expect(elo.kfactor).to.equal(32);
  });
  describe('should evaluate ratings correctly', () => {
    it('should calculate 1v1 scores correctly', () => {
      let elo = new ELOSystem(32, 1000);
      let p1 = elo.createRating();
      let p2 = elo.createRating();
      elo.rate([p1, p2], [1, 2]);
      expect(p1.score).to.equal(1016);
      expect(p2.score).to.equal(984);
    });
    it('should calculate n agent scores correctly', () => {
      let elo = new ELOSystem(32, 1000);
      let ratings = [];
      let ranks = [1, 2, 3, 3, 4];
      for (let i = 0; i < 5; i++) {
        ratings.push(elo.createRating());
      }
      elo.rate(ratings, ranks);
      expect(ratings[0].score).to.equal(1064);
      expect(ratings[1].score).to.equal(1032);
      expect(ratings[2].score).to.equal(984);
      expect(ratings[3].score).to.equal(984);
      expect(ratings[4].score).to.equal(936);
    });
  });
});
