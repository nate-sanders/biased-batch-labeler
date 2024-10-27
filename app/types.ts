export interface User {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dataset {
  id: string;
  name: string;
  projectId: string;
  dataPoints: DataPoint[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DataPoint {
  id: string;
  timestamp: string;
  value: number;
  datasetId: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Annotation {
  id: string;
  dataPointId: string;
  labelId: string;
  createdAt: Date;
}
