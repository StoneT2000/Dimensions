import React, { useEffect, useState } from 'react';
import './index.scss';
import DefaultLayout from '../../components/layouts/default';
import { useParams } from 'react-router-dom';

import { getDimension } from '../../actions/dimensions';
//@ts-ignore
import { Dimension } from '../../../../../Dimension';

function DimensionPage(props: any) {
  const params: any = useParams();
  const [dimension, setDimension] = useState<Dimension>();
  useEffect(() => {
    if (params.id) {
      getDimension(params.id).then((res) => {
        if (res instanceof Dimension)  {
          setDimension(res);
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
      </div>
    </DefaultLayout>
  );
}

export default DimensionPage
