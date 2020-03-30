import React, { useState, useEffect } from 'react';

import './index.scss';
import { Dimension } from '../../../../../Dimension';

const DimensionCard = (props: {dimension: Dimension}) => {

  return (
    <div className="DimensionCard">
      <h2>{props.dimension.name}</h2>
      <p className='matches'>Matches: {props.dimension.matches.length}</p>
    </div>
  )
}

export default DimensionCard
