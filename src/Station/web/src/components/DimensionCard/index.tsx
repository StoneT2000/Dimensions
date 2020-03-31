import React, { useState, useEffect } from 'react';

import './index.scss';
import { Dimension } from '../../../../../Dimension';
import { Link } from 'react-router-dom';

const DimensionCard = (props: {dimension: Dimension}) => {

  return (
    <div className="DimensionCard">
      <Link to={'/dimensions/' + props.dimension.id}><h2 className='title'>{props.dimension.name}</h2></Link>
      <p className='matches'>Design: {props.dimension.design.name}</p>
      <p className='matches'>Matches: {props.dimension.matches.length}</p>
    </div>
  )
}

export default DimensionCard;
