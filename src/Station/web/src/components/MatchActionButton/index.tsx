import React from 'react';
import { runMatch, stopMatch, reRunMatch, removeMatch, resumeMatch } from '../../actions/match';
import { Button } from 'antd';
import { Match } from '../../../../../Match';
import './index.scss';
const MatchActionButton = (props:{match: Match}) => {

  let btns;

  switch (props.match.matchStatus) {
    case 'uninitialized': // Uninitialized
      btns = <Button loading={true}>Run</Button>
      break;
    case 'ready': // Ready
      btns = <Button onClick={() => {runMatch(props.match.configs.dimensionID, props.match.id)}}>Run</Button>
      break;
    case 'running': // Running
      btns = <Button onClick={() => {stopMatch(props.match.configs.dimensionID, props.match.id)}}>Stop</Button>
      break;
    case 'stopped': // Stopped
      btns = <Button onClick={() => {resumeMatch(props.match.configs.dimensionID, props.match.id)}}>Resume</Button>
      break;
    case 'finished': // Finished
      btns = [<Button onClick={() => {removeMatch(props.match.configs.dimensionID, props.match.id)}} disabled>Remove</Button>,
        <Button onClick={() => {reRunMatch(props.match.configs.dimensionID, props.match.id)}}>Re-run</Button>
      ]
      break;
    case 'error': // Error
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
