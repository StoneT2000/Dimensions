import React, { useEffect, useState } from 'react';
import './index.scss';
import { Table, message} from 'antd';

import DefaultLayout from '../../components/layouts/default';
import { useParams, useHistory, Link } from 'react-router-dom';

import { getDimension, getMatchesFromDimension } from '../../actions/dimensions';

// NOTE!! Can import outside src as long as we dont use instanceof dimension or actually use it, we can just it for typings
import { Dimension } from '../../../../../Dimension';
import { Match } from '../../../../../Match';
import DimensionCard from '../../components/DimensionCard';
import MatchActionButton from '../../components/MatchActionButton';


function DimensionsPage(props: any) {
  const params: any = useParams();
  const history: any = useHistory();
  const [dimension, setDimension] = useState<Dimension>();
  // const [matches, setMatches] = useState<Array<Match>>([]);
  const [data, setData] = useState<Array<any>>([]);
  const columns = [
    {
      title: 'Match Name',
      dataIndex: 'matchname',
      render: (match: Match) => <Link to={`${history.location.pathname}/matches/${match.id}`}>{match.name}</Link>,
    },
    {
      title: 'Creation Date',
      dataIndex: 'creationdate',
    },
    {
      title: 'Status',
      dataIndex: 'status',
    },
    {
      title: 'Action',
      dataIndex: 'action',
      render: (match: Match) => {
        //@ts-ignore
        return (<MatchActionButton match={match} />)
      }
    }
  ];
  const mapMatchStatusToName = (status: number): string => {
    switch(status) {
      case 0:
        return 'Uninitialized';
      case 1:
        return 'Ready';
      case 2:
        return 'Running';
      case 3:
        return 'Stopped';
      case 4:
        return 'Finished';
      case 5:
        return 'Error / Crash';
      default:
        return 'Unknown'
    }
  }
  const startRefresh = () => {
    let intv = setInterval(() => {
      getDimension(params.id).then((res) => {
        if (!(res instanceof Array))  {
          setDimension(res);
          getMatchesFromDimension(res.id).then((res) => {
            // setMatches(res);
            let newData = res.map((match: Match, index) => {
              return {
                key: index,
                matchname: match,
                creationdate: match.creationDate,
                status: mapMatchStatusToName(match.matchStatus),
                action: match
              }
            });
            setData(newData);
          })
        }
        else {
          console.error("something wrong happened");
        }
      }).catch(() => {
        message.error('Backend is not setup');
        clearInterval(intv);
      });
    }, 500);
  }
  useEffect(() => {
    if (params.id) {
      startRefresh();
    }
  }, []);
  return (
    <DefaultLayout>
      <div className='DimensionPage'>
        {dimension &&
          <div>
            <h2>{dimension.name}</h2>
            <h4 className='meta-data-title'>Metadata</h4>
            <p className='meta-data'>
              id: {dimension.id} <br />
              Used Design: { dimension.design.name } <br />
              Logging Level: {dimension.configs.loggingLevel}
            </p>
            <h4>Ongoing Matches</h4>
            <Table className='matchTable'
              columns={columns}
              dataSource={data}
            />
          </div> 
        }
      </div>
    </DefaultLayout>
  );
}

function DimensionsListPage() {
  const params: any = useParams();
  const [dimensions, setDimensions] = useState<Array<Dimension>>([]);
  useEffect(() => {
    getDimension().then((res) => {
      if (res instanceof Array)  {
        setDimensions(res);
      }
      else {
        console.error("something wrong happened");
      }
    })
  }, []);
  return (
    <DefaultLayout>
      <div className='DimensionPage'>
        <h2>Dimensions Observed</h2>
        {dimensions.length &&
          dimensions.map((dimension: Dimension) => {
            return (
              <DimensionCard key={dimension.id} dimension={dimension}/>
            )
          })
        }
      </div>
    </DefaultLayout>
  );
}
DimensionsPage.DimensionsListPage = DimensionsListPage;
export default DimensionsPage
