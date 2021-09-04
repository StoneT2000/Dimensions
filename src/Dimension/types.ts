export interface Configs{
  /** 
   * Name of the dimension 
   * 
   * @default `default_dimension`
   */
  name: string;
  /** 
   * When True, activates the Station, which serves a local server that one can fetch information about the dimension from
   * 
   * @default `false`
   */
  station: boolean;

  /**
   * The path to the environment file or executable to use
   * 
   * If .py ...
   * 
   * Otherwise we expect the file to be an executable that accepts our input format for agent actions and outputs state, reward etc. as a JSON
   * 
   */
  environment: string;
  
}