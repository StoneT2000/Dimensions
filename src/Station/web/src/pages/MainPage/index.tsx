import React, { useEffect, useState } from 'react';
import './index.scss';
import DefaultLayout from "../../components/layouts/default";
import { getDimensions, getMatchesFromDimension } from '../../actions/dimensions';
import DimensionCard from '../../components/DimensionCard';
import { Dimension } from '../../../../../Dimension';

function MainPage(props: any) {
  const [dimensions, setDimensions] = useState<Array<Dimension>>([]);
  useEffect(() => {
    getDimensions().then((res: any) => {
      console.log(res);
      //@ts-ignore
      setDimensions(res);
    }).catch((error) => {
      console.error(error);
    })
  }, []);
  return (
    <DefaultLayout>
      <div className='Main'>
        <div className='hero'>
          <h1 id='title'>Dimensions Station</h1>
          <p className='subtext'>Observe your Dimensions, Matches, and Tournaments, and basically everything</p>
          {
            dimensions.length &&
              dimensions.map((dim: Dimension) => {
                return (
                  <DimensionCard dimension={dim}/>
                )
              })
          }
        </div>
      </div>
    </DefaultLayout>
  );
}

export default MainPage
