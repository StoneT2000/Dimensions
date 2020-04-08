import React, { useEffect, useState } from 'react';
import './index.scss';
import { message, Table } from 'antd';

import DefaultLayout from '../../components/layouts/default';
import MatchActionButton from '../../components/MatchActionButton';
import { useParams, useHistory, Link } from 'react-router-dom';

import { getMatchFromDimension } from '../../actions/dimensions';

// NOTE!! Can import outside src as long as we dont use instanceof dimension or actually use it, we can just it for typings
import { Match } from '../../../../../Match';
import { Agent, AgentStatus } from '../../../../../Agent';

let intv: any;
function MatchPage() {
  const params: any = useParams();
  const history: any = useHistory();
  const [match, setMatch] = useState<Match>();
  const [data, setData] = useState<Array<any>>([]);
  const columns = [
    {
      title: 'Agent Name',
      dataIndex: 'agentname',
      render: (agent: Agent) => <Link to={`${history.location.pathname}/agents/${agent.id}`}>{agent.name}</Link>,
    },
    {
      title: 'Creation Date',
      dataIndex: 'creationdate',
    },
    {
      title: 'Source',
      dataIndex:'src'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: AgentStatus) => <span>{status}</span>
    },
  ];
  const startRefresh = () => {
    intv = setInterval(() => {
      getMatchFromDimension(params.id, params.matchID).then((res) => {
        if (!(res instanceof Array))  {
          setMatch(res);
          let newData = res.agents.map((agent) => {
            return {
              src: agent.src,
              agentname: agent,
              creationdate: agent.creationDate,
              status: agent.status
            }
          })
          setData(newData);
        }
        else {
          console.error("something wrong happened");
        }
      }).catch((error) => {
        message.error('Backend is not setup');
        clearInterval(intv);
      });
    }, 500);
  }
  useEffect(() => {
    if (params.matchID) {
      startRefresh();
    }
    return () => {
      clearInterval(intv);
    }
  }, []);
  return (
    <DefaultLayout>
      <div className='DimensionPage'>
        {match &&
          <div>
            <h2>{match.name}</h2>
            <h4 className='meta-data-title'>Metadata</h4>
            <p className='meta-data'>
              id: {match.id} <br />
              Used Design: { match.design.name } <br />
              Creation Date: {match.creationDate} <br />
              Match Status: {match.matchStatus} <br />
              Time Step: {match.timeStep}
            </p>
            <h4>Match Actions</h4>
            <MatchActionButton match={match}/>
            <h4>Match Results:</h4>
            {match.results ? <a target='_blank' href={process.env.REACT_APP_API + `/api/dimensions/${params.id}/match/${params.matchID}/results`}>Results</a> : 'No results yet'}
            <h4>Agents / Players</h4>
            <Table className='agentTable'
              columns={columns}
              dataSource={data}
            />
          </div> 
        }
      </div>
    </DefaultLayout>
  );
}

export default MatchPage
