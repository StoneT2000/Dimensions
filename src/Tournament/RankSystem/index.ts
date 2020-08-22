import { ELORating } from "../ELO";
import { Rating } from "ts-trueskill";
import { Agent } from "../../Agent";

/**
 * Rank System enums and namespaces for the kind of ranking systems you can choose for a {@link Tournament}
 */
export enum RankSystem {
  /** Ranking by wins, ties and losses */
  WINS = 'wins', 
  /** Ranking by the ELO ranking system */
  ELO = 'elo',
  /** Ranking by Microsoft's Trueskill */
  TRUESKILL = 'trueskill'
}

export namespace RankSystem {
  
  export interface ConfigsBase {}

  /**
   * Wins rank system. Ranks based on Wins, Ties, and Losses.
   */
  export namespace WINS {
    /**
     * The configuration interface for configuring the {@link WINS} ranking system
     */
    export interface Configs extends ConfigsBase {
      /** Points given per win in a {@link Match} */
      winValue: number
      /** Points given per tie in a {@link Match} */
      tieValue: number
      /** Points given per loss in a {@link Match} */
      lossValue: number,
      /** True if first place is the one with the most points. */
      descending: boolean
    }

    /** The results interface that must be returned by a result handler for a {@link Tournament} */
    export interface Results {
      /** Array of agent IDs of {@link agent}s that won in the {@link Match}*/
      winners: Array<Agent.ID>
      /** Array of agent IDs of {@link agent}s that tied in the {@link Match}*/
      ties: Array<Agent.ID>
      /** Array of agent IDs of {@link agent}s that lost in the {@link Match}*/
      losers: Array<Agent.ID>
    }
  }
  /**
   * ELO Rank system
   */
  export namespace ELO {

    /**
     * The configuration interface for configuring the {@link ELO} ranking system
     */
    export interface Configs extends ConfigsBase {
      /** 
       * Starting ELO score 
       * @default `1000`
       */
      startingScore: number,
      /** 
       * The k factor to use for the ranking.
       * @default `32`
       */
      kFactor: number,
    }
    /** The results interface that must be returned by a result handler for a {@link Tournament} */
    export interface Results {
      /** 
       * Array of {@link Agent.ID}s and their ranks in a {@link Match}, 
       * An agent scores a 1 against another agent if their rank is higher. 0.5 if the same, and 0 if lower
       * Same interface as {@link TRUESKILL.Results} and result handlers can be used interchangeably
       */
      ranks: Array<{rank: number, agentID: Agent.ID}>
    }

    /** The current rank state of a player */
    export interface RankState {
      /** The ELO Rating */
      rating: ELORating
    }
  }

  export namespace TRUESKILL {
    /** The Configuration interface used for configuring the {@link TRUESKILL} ranking system */
    export interface Configs extends ConfigsBase {
      /** 
       * The initial Mu value players start with 
       * @default `25`
       */
      initialMu: number,
      /** 
       * The initial sigma value players start with 
       * @default `25/3`
       */
      initialSigma: number
    }
    /** The results interface that must be returned by a result handler for a {@link Tournament} */
    export interface Results {
      /** Array of agentIDs and their ranks in a {@link Match}, where rank 1 is highest */
      ranks: Array<{rank: number, agentID: Agent.ID}> 
    }
    /** The current rank state of a player */
    export interface RankState { 
      /** 
       * The trueskill rating 
       * 
       * rating.mu, rating.sigma returns the mu and sigma of the rank. 
       */
      rating: Rating
    }
  }
}