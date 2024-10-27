export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          name: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          updated_at?: string
        }
      }
      datasets: {
        Row: {
          id: string
          name: string
          project_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          project_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          updated_at?: string
        }
      }
      data_points: {
        Row: {
          id: string
          timestamp: string
          value: number
          dataset_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          timestamp: string
          value: number
          dataset_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          timestamp?: string
          value?: number
          updated_at?: string
        }
      }
      labels: {
        Row: {
          id: string
          name: string
          color: string
          project_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          color: string
          project_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          color?: string
          updated_at?: string
        }
      }
      annotations: {
        Row: {
          id: string
          data_point_id: string
          label_id: string
          created_at: string
        }
        Insert: {
          id?: string
          data_point_id: string
          label_id: string
          created_at?: string
        }
        Update: {
          data_point_id?: string
          label_id?: string
        }
      }
    }
  }
}
