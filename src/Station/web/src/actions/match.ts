import axios, { AxiosResponse } from 'axios';
import { Dimension } from '../../../../Dimension';
import { Match } from '../../../../Match';


// Returns all dimensions if no input
export const getDimension = async (id: number = -1): Promise<Array<Dimension> | Dimension> => {
  return new Promise((resolve, reject) => {
    axios.get(process.env.REACT_APP_API + '/api/dimensions/' + (id === -1 ? '' : id)).then((res: AxiosResponse) => {
      if (id === -1) {
        resolve(res.data.dimensions);
      }
      else {
        resolve(res.data.dimension);
      }
    }).catch((error) => {
      reject(error);
    })
  })
}


export const runMatch = async (dimensionID:number, matchID: number): Promise<any> => {
  return new Promise((resolve, reject) => {
    axios.post(process.env.REACT_APP_API + `/api/dimensions/${dimensionID}/match/${matchID}/run`).then((res: AxiosResponse) => {
      console.log(res);
      resolve(res);
    }).catch((error) => {
      reject(error);
    })
  })
}

export const stopMatch = async (dimensionID:number, matchID: number): Promise<any> => {
  return new Promise((resolve, reject) => {
    axios.post(process.env.REACT_APP_API + `/api/dimensions/${dimensionID}/match/${matchID}/stop`).then((res: AxiosResponse) => {
      console.log(res);
      resolve(res);
    }).catch((error) => {
      reject(error);
    })
  })
}

export const resumeMatch = async (dimensionID:number, matchID: number): Promise<any> => {
  return new Promise((resolve, reject) => {
    axios.post(process.env.REACT_APP_API + `/api/dimensions/${dimensionID}/match/${matchID}/resume`).then((res: AxiosResponse) => {
      console.log(res);
      resolve(res);
    }).catch((error) => {
      reject(error);
    })
  })
}

export const reRunMatch = async (dimensionID:number, matchID: number): Promise<any> => {
  return new Promise((resolve, reject) => {
    axios.post(process.env.REACT_APP_API + `/api/dimensions/${dimensionID}/match/${matchID}/rerun`).then((res: AxiosResponse) => {
      console.log(res);
      resolve(res);
    }).catch((error) => {
      reject(error);
    })
  })
}

export const removeMatch = async (dimensionID:number, matchID: number): Promise<any> => {
  return new Promise((resolve, reject) => {
    axios.post(process.env.REACT_APP_API + `/api/dimensions/${dimensionID}/match/${matchID}/remove`).then((res: AxiosResponse) => {
      console.log(res);
      resolve(res);
    }).catch((error) => {
      reject(error);
    })
  })
}
