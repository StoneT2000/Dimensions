export interface Configs {
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
}
