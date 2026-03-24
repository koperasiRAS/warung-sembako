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
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'owner' | 'cashier'
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role: 'owner' | 'cashier'
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'owner' | 'cashier'
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          price: number
          cost_price: number
          stock: number
          low_stock_threshold: number
          category_id: string | null
          barcode: string | null
          sku: string | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          price: number
          cost_price?: number
          stock: number
          low_stock_threshold?: number
          category_id?: string | null
          barcode?: string | null
          sku?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          price?: number
          cost_price?: number
          stock?: number
          low_stock_threshold?: number
          category_id?: string | null
          barcode?: string | null
          sku?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          total: number
          payment_method: 'cash' | 'qris' | 'transfer' | 'hutang'
          cashier_id: string
          status: 'completed' | 'voided'
          created_at: string
        }
        Insert: {
          id?: string
          total: number
          payment_method: 'cash' | 'qris' | 'transfer' | 'hutang'
          cashier_id: string
          status?: 'completed' | 'voided'
          created_at?: string
        }
        Update: {
          id?: string
          total?: number
          payment_method?: 'cash' | 'qris' | 'transfer' | 'hutang'
          cashier_id?: string
          status?: 'completed' | 'voided'
          created_at?: string
        }
      }
      transaction_items: {
        Row: {
          id: string
          transaction_id: string
          product_id: string
          qty: number
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          product_id: string
          qty: number
          price: number
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          product_id?: string
          qty?: number
          price?: number
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          title: string
          amount: number
          payment_method: 'cash' | 'bank'
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          amount: number
          payment_method: 'cash' | 'bank'
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          amount?: number
          payment_method?: 'cash' | 'bank'
          note?: string | null
          created_at?: string
        }
      }
      daily_balances: {
        Row: {
          id: string
          date: string
          cash_balance: number
          bank_balance: number
          opening_cash: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          cash_balance?: number
          bank_balance?: number
          opening_cash?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          cash_balance?: number
          bank_balance?: number
          opening_cash?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
