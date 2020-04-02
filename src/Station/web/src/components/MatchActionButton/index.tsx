import React, { useState, useEffect } from 'react';
import { runMatch, stopMatch, reRunMatch, removeMatch } from '../../actions/match';
import { Button } from 'antd';
import { Match } from '../../../../../Match';
import './index.scss';
const MatchActionButton = (props:{match: Match}) => {

  let btns;

  switch (props.match.matchStatus) {
    case 0: // Uninitialized
      btns = <Button loading={true}>Run</Button>
      break;
    case 1: // Ready
      btns = <Button onClick={() => {runMatch(props.match.configs.dimensionID, props.match.id)}}>Run</Button>
      break;
    case 2: // Running
      btns = <Button onClick={() => {stopMatch(props.match.configs.dimensionID, props.match.id)}} disabled>Stop</Button>
      break;
    case 3: // Stopped
      btns = <Button onClick={() => {runMatch(props.match.configs.dimensionID, props.match.id)}}>Run</Button>
      break;
    case 4: // Finished
      btns = [<Button onClick={() => {removeMatch(props.match.configs.dimensionID, props.match.id)}} disabled>Remove</Button>,
        <Button onClick={() => {reRunMatch(props.match.configs.dimensionID, props.match.id)}} disabled>Re-run</Button>
      ]
      break;
    case 5: // Error
      btns = [<Button onClick={() => {removeMatch(props.match.configs.dimensionID, props.match.id)}} disabled>Remove</Button>,
        <Button onClick={() => {reRunMatch(props.match.configs.dimensionID, props.match.id)}} disabled>Re-run</Button>
      ]
      break;
    default:
      btns = 'Error';
  }
  return (
    <div className='MatchActionButtons'>
      {btns}
    </div>
  )
}

export default MatchActionButton
