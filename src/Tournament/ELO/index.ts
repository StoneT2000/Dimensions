import { FatalError } from "../../DimensionError";

export class ELOSystem {

  constructor(public kfactor: number, public startingScore: number) {

  } 

  createRating(startingScore: number = this.startingScore) {
    return new ELORating(startingScore);
  }

  expectedScores1v1(p1: ELORating, p2: ELORating) {
    let Q_1 = Math.pow(10, p1.score / 400);
    let Q_2 = Math.pow(10, p2.score / 400);
    let E_1 = Q_1 / (Q_1 + Q_2); // expected for player 1
    let E_2 = Q_2 / (Q_1 + Q_2); // expected for player 2
    return [E_1, E_2]
  }
  rate1v1(p1: ELORating, p2: ELORating, scores: Array<number>) {
    let [E_1, E_2] = this.expectedScores1v1(p1, p2);
    // actual should be two length array with the scores of each player
    p1.score = Math.round(p1.score + this.kfactor * (scores[0] - E_1));
    p2.score = Math.round(p2.score + this.kfactor * (scores[1] - E_1));
  }
  rate(ratings: Array<ELORating>, ranks: Array<number>) {
    if (ranks.length != ratings.length) throw new FatalError('Ratings and ranks lengths do not match!');
    let expectedMatrix = []; // element at i, j is expected score of player i against j.
    
    let scoreDeltas = new Array(ratings.length); // stores the change in scores

    let actualScores = []; // store the actual scores against all other players based on ranks argument

    for (let i = 0; i < ratings.length; i++) {
      expectedMatrix.push(new Array(ratings.length));
      actualScores.push(0);
    }

    // calculate total scores as well against all players
    for (let i = 0; i < ratings.length; i++) {
      for (let j = i + 1; j < ratings.length; j++) {
        let [E_i, E_j] = this.expectedScores1v1(ratings[i], ratings[j]);
        expectedMatrix[i][j] = E_i;
        expectedMatrix[j][i] = E_j;
      }
    }

    for (let i = 0; i < ratings.length; i++) {
      let E_i_total = 0;
      for (let j = 0; j < ratings.length; j++) {
        if (j != i) {
          // store expected total scores for player i
          E_i_total += expectedMatrix[i][j];
          // store actual total scores for player i
          if (ranks[i] > ranks[j]) {
            actualScores[i] += 1;
          }
          else if (ranks[i] == ranks[j]) {
            actualScores[i] += 0.5;
          }
        }
      }
      // update player scores
      ratings[i].score = Math.round(ratings[i].score + this.kfactor * (E_i_total - actualScores[i]));
    }
  }
}
export class ELORating {
  constructor(public score: number) {

  }
}