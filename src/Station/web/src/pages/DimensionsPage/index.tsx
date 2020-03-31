import React, { useEffect, useState } from 'react';
import './index.scss';
import { Button, Table } from 'antd';
import { Tree } from 'antd';

import DefaultLayout from '../../components/layouts/default';
import { useParams, useHistory, Link } from 'react-router-dom';

import { getDimension, getMatchesFromDimension } from '../../actions/dimensions';

// NOTE!! Can import outside src as long as we dont use instanceof dimension or actually use it, we can just it for typings
import { Dimension } from '../../../../../Dimension';
import { Match } from '../../../../../Match';
import DimensionCard from '../../components/DimensionCard';

const { TreeNode } = Tree;

function DimensionsPage(props: any) {
  const params: any = useParams();
  const history: any = useHistory();
  const [dimension, setDimension] = useState<Dimension>();
  const [matches, setMatches] = useState<Array<Match>>([]);
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
  ];
  useEffect(() => {
    console.log(history);
    if (params.id) {
      getDimension(params.id).then((res) => {
        if (!(res instanceof Array))  {
          setDimension(res);
          getMatchesFromDimension(res.id).then((res) => {
            setMatches(res);
            let newData = res.map((match: Match, index) => {
              return {
                key: index,
                matchname: match,
                creationdate: match.creationDate,
                status: match.matchStatus
              }
            });
            setData(newData);
          })
        }
        else {
          console.error("something wrong happened");
        }
      })
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
              Logging Level: {dimension.loggingLevel}
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
