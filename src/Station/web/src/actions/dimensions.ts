import axios, { AxiosResponse } from 'axios';
import { Dimension } from '../../../../Dimension';


// Returns all dimensions if no input
export const getDimension = async (id: number = -1): Promise<Array<Dimension> | Dimension> => {
  return new Promise((resolve, reject) => {
    axios.get(process.env.REACT_APP_API + '/api/dimensions/' + (id === -1 ? '' : id)).then((res: AxiosResponse) => {
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