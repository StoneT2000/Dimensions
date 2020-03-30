import axios, { AxiosResponse } from 'axios';
import { Dimension } from '../../../../Dimension';



export const getDimensions = async (): Promise<Array<Dimension>> => {
  return new Promise((resolve, reject) => {
    axios.get(process.env.REACT_APP_API + '/api/dimensions/').then((res: AxiosResponse) => {
      resolve(res.data.dimensions);
    }).catch((error) => {
      reject(error);
    })
  })
}


export const getMatchesFromDimension = async (dimensionID: number) => {
  return new Promise((resolve, reject) => {
    axios.get(process.env.REACT_APP_API + `/api/dimensions/${dimensionID}/match`).then((res: AxiosResponse) => {
      resolve(res.data.matches);
    }).catch((error) => {
      reject(error);
    })
  })
}