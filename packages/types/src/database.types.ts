export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accountant_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by_user_id: string | null
          email: string
          expires_at: string | null
          firm_name: string | null
          home_id: string
          id: string
          invited_by_user_id: string
          last_login_at: string | null
          name: string | null
          organisation_id: string | null
          revoked_at: string | null
          revoked_by_user_id: string | null
          role_scope: string
          tenant_id: string
          token_hash: string | null
          updated_at: string
          updated_by_user_id: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          email: string
          expires_at?: string | null
          firm_name?: string | null
          home_id: string
          id?: string
          invited_by_user_id: string
          last_login_at?: string | null
          name?: string | null
          organisation_id?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role_scope?: string
          tenant_id: string
          token_hash?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          email?: string
          expires_at?: string | null
          firm_name?: string | null
          home_id?: string
          id?: string
          invited_by_user_id?: string
          last_login_at?: string | null
          name?: string | null
          organisation_id?: string | null
          revoked_at?: string | null
          revoked_by_user_id?: string | null
          role_scope?: string
          tenant_id?: string
          token_hash?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accountant_invitations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_invitations_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_invitations_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_invitations_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_invitations_revoked_by_user_id_fkey"
            columns: ["revoked_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_invitations_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accountant_invitations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action_code: string
          actor_user_id: string | null
          after_state_json: Json | null
          before_state_json: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          home_id: string | null
          id: string
          tenant_id: string
        }
        Insert: {
          action_code: string
          actor_user_id?: string | null
          after_state_json?: Json | null
          before_state_json?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          home_id?: string | null
          id?: string
          tenant_id: string
        }
        Update: {
          action_code?: string
          actor_user_id?: string | null
          after_state_json?: Json | null
          before_state_json?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          home_id?: string | null
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_occupancy_snapshots: {
        Row: {
          bed_capacity: number | null
          created_at: string
          created_by_user_id: string | null
          expected_admissions_next_7_days: number
          expected_discharges_next_7_days: number
          home_id: string
          id: string
          occupied_beds: number
          snapshot_at: string
          source: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          vacant_beds: number
        }
        Insert: {
          bed_capacity?: number | null
          created_at?: string
          created_by_user_id?: string | null
          expected_admissions_next_7_days?: number
          expected_discharges_next_7_days?: number
          home_id: string
          id?: string
          occupied_beds: number
          snapshot_at?: string
          source?: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          vacant_beds: number
        }
        Update: {
          bed_capacity?: number | null
          created_at?: string
          created_by_user_id?: string | null
          expected_admissions_next_7_days?: number
          expected_discharges_next_7_days?: number
          home_id?: string
          id?: string
          occupied_beds?: number
          snapshot_at?: string
          source?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          vacant_beds?: number
        }
        Relationships: [
          {
            foreignKeyName: "bed_occupancy_snapshots_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_occupancy_snapshots_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_occupancy_snapshots_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      beds: {
        Row: {
          capacity: number
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          room_number: string
          status: Database["public"]["Enums"]["bed_status"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          room_number: string
          status?: Database["public"]["Enums"]["bed_status"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          room_number?: string
          status?: Database["public"]["Enums"]["bed_status"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beds_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beds_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beds_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          citations_json: Json | null
          cited_row_ids: string[]
          content: string | null
          cost_pence: number | null
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          latency_ms: number | null
          model_id: string | null
          role: Database["public"]["Enums"]["chat_role"]
          session_id: string
          tenant_id: string
          tokens_in: number | null
          tokens_out: number | null
          tokens_used: number | null
          tool_input: Json | null
          tool_name: string | null
          tool_output: Json | null
          tools_used: string[]
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          citations_json?: Json | null
          cited_row_ids?: string[]
          content?: string | null
          cost_pence?: number | null
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          latency_ms?: number | null
          model_id?: string | null
          role: Database["public"]["Enums"]["chat_role"]
          session_id: string
          tenant_id: string
          tokens_in?: number | null
          tokens_out?: number | null
          tokens_used?: number | null
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
          tools_used?: string[]
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          citations_json?: Json | null
          cited_row_ids?: string[]
          content?: string | null
          cost_pence?: number | null
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          latency_ms?: number | null
          model_id?: string | null
          role?: Database["public"]["Enums"]["chat_role"]
          session_id?: string
          tenant_id?: string
          tokens_in?: number | null
          tokens_out?: number | null
          tokens_used?: number | null
          tool_input?: Json | null
          tool_name?: string | null
          tool_output?: Json | null
          tools_used?: string[]
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          last_message_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["chat_session_status"]
          tenant_id: string
          title: string | null
          updated_at: string
          updated_by_user_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          last_message_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["chat_session_status"]
          tenant_id: string
          title?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          last_message_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["chat_session_status"]
          tenant_id?: string
          title?: string | null
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_savings_log: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          recorded_at: string
          related_entity_id: string | null
          related_entity_type: string | null
          savings_pence: number
          source: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          recorded_at?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          savings_pence: number
          source: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          recorded_at?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          savings_pence?: number
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_savings_log_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_savings_log_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      dependency_assessments: {
        Row: {
          assessed_by_user_id: string | null
          assessment_date: string
          behaviour_score: number
          clinical_complexity_score: number
          cognition_score: number
          continence_score: number
          created_at: string
          created_by_user_id: string | null
          external_resident_ref: string | null
          home_id: string
          id: string
          mobility_score: number
          overall_band: string
          resident_id: string | null
          source: Database["public"]["Enums"]["dependency_source"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          assessed_by_user_id?: string | null
          assessment_date: string
          behaviour_score: number
          clinical_complexity_score: number
          cognition_score: number
          continence_score: number
          created_at?: string
          created_by_user_id?: string | null
          external_resident_ref?: string | null
          home_id: string
          id?: string
          mobility_score: number
          overall_band: string
          resident_id?: string | null
          source?: Database["public"]["Enums"]["dependency_source"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          assessed_by_user_id?: string | null
          assessment_date?: string
          behaviour_score?: number
          clinical_complexity_score?: number
          cognition_score?: number
          continence_score?: number
          created_at?: string
          created_by_user_id?: string | null
          external_resident_ref?: string | null
          home_id?: string
          id?: string
          mobility_score?: number
          overall_band?: string
          resident_id?: string | null
          source?: Database["public"]["Enums"]["dependency_source"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dependency_assessments_assessed_by_user_id_fkey"
            columns: ["assessed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependency_assessments_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependency_assessments_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependency_assessments_resident_id_fkey"
            columns: ["resident_id"]
            isOneToOne: false
            referencedRelation: "residents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependency_assessments_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      geofences: {
        Row: {
          centre_lat: number
          centre_lng: number
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          radius_metres: number
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          centre_lat: number
          centre_lng: number
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          radius_metres?: number
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          centre_lat?: number
          centre_lng?: number
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          radius_metres?: number
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "geofences_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofences_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geofences_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      homes: {
        Row: {
          address: string
          bank_holiday_region: Database["public"]["Enums"]["bank_holiday_region"]
          bank_holidays_included: boolean
          bed_capacity: number
          clock_in_early_window_minutes: number
          cqc_registration_number: string | null
          created_at: string
          created_by_user_id: string | null
          holiday_allocation_unit: Database["public"]["Enums"]["allocation_unit"]
          holiday_year_start_month: number
          id: string
          name: string
          no_clock_out_hold_minutes: number
          no_show_grace_minutes: number
          organisation_id: string
          pay_cycle_id: string | null
          registration_type: Database["public"]["Enums"]["registration_type"]
          rota_period_weeks: number
          rota_start_day: number
          tenant_id: string
          time_zone: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          address: string
          bank_holiday_region?: Database["public"]["Enums"]["bank_holiday_region"]
          bank_holidays_included?: boolean
          bed_capacity: number
          clock_in_early_window_minutes?: number
          cqc_registration_number?: string | null
          created_at?: string
          created_by_user_id?: string | null
          holiday_allocation_unit?: Database["public"]["Enums"]["allocation_unit"]
          holiday_year_start_month?: number
          id?: string
          name: string
          no_clock_out_hold_minutes?: number
          no_show_grace_minutes?: number
          organisation_id: string
          pay_cycle_id?: string | null
          registration_type: Database["public"]["Enums"]["registration_type"]
          rota_period_weeks?: number
          rota_start_day?: number
          tenant_id?: string
          time_zone?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          address?: string
          bank_holiday_region?: Database["public"]["Enums"]["bank_holiday_region"]
          bank_holidays_included?: boolean
          bed_capacity?: number
          clock_in_early_window_minutes?: number
          cqc_registration_number?: string | null
          created_at?: string
          created_by_user_id?: string | null
          holiday_allocation_unit?: Database["public"]["Enums"]["allocation_unit"]
          holiday_year_start_month?: number
          id?: string
          name?: string
          no_clock_out_hold_minutes?: number
          no_show_grace_minutes?: number
          organisation_id?: string
          pay_cycle_id?: string | null
          registration_type?: Database["public"]["Enums"]["registration_type"]
          rota_period_weeks?: number
          rota_start_day?: number
          tenant_id?: string
          time_zone?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homes_pay_cycle_id_fkey"
            columns: ["pay_cycle_id"]
            isOneToOne: false
            referencedRelation: "pay_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_pairing_tokens: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          expires_at: string
          home_id: string
          id: string
          kiosk_id: string | null
          kiosk_name: string
          tenant_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          expires_at: string
          home_id: string
          id?: string
          kiosk_id?: string | null
          kiosk_name: string
          tenant_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          expires_at?: string
          home_id?: string
          id?: string
          kiosk_id?: string | null
          kiosk_name?: string
          tenant_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_pairing_tokens_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_pairing_tokens_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosk_pairing_tokens_kiosk_id_fkey"
            columns: ["kiosk_id"]
            isOneToOne: false
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosks: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          location_description: string | null
          lockdown_pin: string | null
          name: string
          paired_at: string | null
          pairing_token: string | null
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          location_description?: string | null
          lockdown_pin?: string | null
          name: string
          paired_at?: string | null
          pairing_token?: string | null
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          location_description?: string | null
          lockdown_pin?: string | null
          name?: string
          paired_at?: string | null
          pairing_token?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kiosks_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosks_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiosks_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          accrued_value: number
          allocation_unit: Database["public"]["Enums"]["allocation_unit"]
          balance_remaining: number | null
          booked_value: number
          carried_over_value: number
          created_at: string
          created_by_user_id: string | null
          entitlement_value: number
          home_id: string
          id: string
          leave_year_start: string
          scheduled_value: number
          staff_id: string
          taken_value: number
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          accrued_value?: number
          allocation_unit: Database["public"]["Enums"]["allocation_unit"]
          balance_remaining?: number | null
          booked_value?: number
          carried_over_value?: number
          created_at?: string
          created_by_user_id?: string | null
          entitlement_value?: number
          home_id: string
          id?: string
          leave_year_start: string
          scheduled_value?: number
          staff_id: string
          taken_value?: number
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          accrued_value?: number
          allocation_unit?: Database["public"]["Enums"]["allocation_unit"]
          balance_remaining?: number | null
          booked_value?: number
          carried_over_value?: number
          created_at?: string
          created_by_user_id?: string | null
          entitlement_value?: number
          home_id?: string
          id?: string
          leave_year_start?: string
          scheduled_value?: number
          staff_id?: string
          taken_value?: number
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          covering_staff_id: string | null
          created_at: string
          created_by_user_id: string | null
          decided_at: string | null
          decided_by_user_id: string | null
          end_date: string
          home_id: string
          id: string
          manager_note: string | null
          staff_id: string
          staff_message: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_request_status"]
          submitted_at: string
          tenant_id: string
          type: Database["public"]["Enums"]["leave_type"]
          updated_at: string
          updated_by_user_id: string | null
          value_requested: number
        }
        Insert: {
          covering_staff_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          decided_at?: string | null
          decided_by_user_id?: string | null
          end_date: string
          home_id: string
          id?: string
          manager_note?: string | null
          staff_id: string
          staff_message?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          submitted_at?: string
          tenant_id: string
          type: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
          updated_by_user_id?: string | null
          value_requested: number
        }
        Update: {
          covering_staff_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          decided_at?: string | null
          decided_by_user_id?: string | null
          end_date?: string
          home_id?: string
          id?: string
          manager_note?: string | null
          staff_id?: string
          staff_message?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          submitted_at?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["leave_type"]
          updated_at?: string
          updated_by_user_id?: string | null
          value_requested?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_covering_staff_id_fkey"
            columns: ["covering_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_decided_by_user_id_fkey"
            columns: ["decided_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_year_month_summary: {
        Row: {
          booked_value: number
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          leave_year_start: string
          month: number
          staff_id: string
          taken_value: number
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          booked_value?: number
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          leave_year_start: string
          month: number
          staff_id: string
          taken_value?: number
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          booked_value?: number
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          leave_year_start?: string
          month?: number
          staff_id?: string
          taken_value?: number
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_year_month_summary_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_year_month_summary_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_year_month_summary_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_year_month_summary_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nfc_badges: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          deactivated_at: string | null
          home_id: string
          id: string
          issued_at: string
          nfc_uid: string
          staff_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          deactivated_at?: string | null
          home_id: string
          id?: string
          issued_at?: string
          nfc_uid: string
          staff_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          deactivated_at?: string | null
          home_id?: string
          id?: string
          issued_at?: string
          nfc_uid?: string
          staff_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfc_badges_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfc_badges_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfc_badges_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfc_badges_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          billing_customer_id: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          billing_customer_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          billing_customer_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: []
      }
      override_digest_log: {
        Row: {
          created_at: string
          home_id: string
          id: string
          override_count: number
          period_end: string
          period_start: string
          sent_at: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          home_id: string
          id?: string
          override_count?: number
          period_end: string
          period_start: string
          sent_at?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          home_id?: string
          id?: string
          override_count?: number
          period_end?: string
          period_start?: string
          sent_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "override_digest_log_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_cycles: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          frequency: Database["public"]["Enums"]["pay_frequency"]
          home_id: string
          id: string
          pay_day_rule: string
          period_start_offset_days: number
          preferred_export_format: Database["public"]["Enums"]["export_format"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          frequency: Database["public"]["Enums"]["pay_frequency"]
          home_id: string
          id?: string
          pay_day_rule: string
          period_start_offset_days?: number
          preferred_export_format?: Database["public"]["Enums"]["export_format"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          frequency?: Database["public"]["Enums"]["pay_frequency"]
          home_id?: string
          id?: string
          pay_day_rule?: string
          period_start_offset_days?: number
          preferred_export_format?: Database["public"]["Enums"]["export_format"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_cycles_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_cycles_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_cycles_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_periods: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          pay_cycle_id: string
          pay_day: string
          period_end_date: string
          period_start_date: string
          status: Database["public"]["Enums"]["pay_period_status"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          weeks_in_period: number
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          pay_cycle_id: string
          pay_day: string
          period_end_date: string
          period_start_date: string
          status?: Database["public"]["Enums"]["pay_period_status"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          weeks_in_period: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          pay_cycle_id?: string
          pay_day?: string
          period_end_date?: string
          period_start_date?: string
          status?: Database["public"]["Enums"]["pay_period_status"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          weeks_in_period?: number
        }
        Relationships: [
          {
            foreignKeyName: "pay_periods_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_periods_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_periods_pay_cycle_id_fkey"
            columns: ["pay_cycle_id"]
            isOneToOne: false
            referencedRelation: "pay_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_periods_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_runs: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string
          created_by_user_id: string | null
          csv_format: Database["public"]["Enums"]["export_format"] | null
          exported_csv_url: string | null
          home_id: string
          id: string
          locked_at: string | null
          marked_filed_at: string | null
          marked_filed_by_user_id: string | null
          pay_period_id: string
          status: Database["public"]["Enums"]["pay_run_state"]
          submitted_by_user_id: string | null
          submitted_for_review_at: string | null
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          csv_format?: Database["public"]["Enums"]["export_format"] | null
          exported_csv_url?: string | null
          home_id: string
          id?: string
          locked_at?: string | null
          marked_filed_at?: string | null
          marked_filed_by_user_id?: string | null
          pay_period_id: string
          status?: Database["public"]["Enums"]["pay_run_state"]
          submitted_by_user_id?: string | null
          submitted_for_review_at?: string | null
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          csv_format?: Database["public"]["Enums"]["export_format"] | null
          exported_csv_url?: string | null
          home_id?: string
          id?: string
          locked_at?: string | null
          marked_filed_at?: string | null
          marked_filed_by_user_id?: string | null
          pay_period_id?: string
          status?: Database["public"]["Enums"]["pay_run_state"]
          submitted_by_user_id?: string | null
          submitted_for_review_at?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_runs_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_marked_filed_by_user_id_fkey"
            columns: ["marked_filed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_pay_period_id_fkey"
            columns: ["pay_period_id"]
            isOneToOne: true
            referencedRelation: "pay_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_submitted_by_user_id_fkey"
            columns: ["submitted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_runs_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_comments: {
        Row: {
          author_name: string | null
          author_user_id: string
          body: string
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          is_accountant: boolean
          parent_comment_id: string | null
          pay_run_id: string
          payslip_id: string | null
          payslip_line_id: string | null
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          author_name?: string | null
          author_user_id: string
          body: string
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          is_accountant?: boolean
          parent_comment_id?: string | null
          pay_run_id: string
          payslip_id?: string | null
          payslip_line_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          author_name?: string | null
          author_user_id?: string
          body?: string
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          is_accountant?: boolean
          parent_comment_id?: string | null
          pay_run_id?: string
          payslip_id?: string | null
          payslip_line_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_comments_author_user_id_fkey"
            columns: ["author_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_comments_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_comments_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "payroll_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_comments_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_comments_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_comments_payslip_line_id_fkey"
            columns: ["payslip_line_id"]
            isOneToOne: false
            referencedRelation: "payslip_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_comments_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_exports: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          file_url: string
          format: Database["public"]["Enums"]["export_format"]
          generated_at: string
          generated_by_user_id: string | null
          home_id: string
          id: string
          pay_run_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          file_url: string
          format: Database["public"]["Enums"]["export_format"]
          generated_at?: string
          generated_by_user_id?: string | null
          home_id: string
          id?: string
          pay_run_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          file_url?: string
          format?: Database["public"]["Enums"]["export_format"]
          generated_at?: string
          generated_by_user_id?: string | null
          home_id?: string
          id?: string
          pay_run_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_exports_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_exports_generated_by_user_id_fkey"
            columns: ["generated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_exports_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_exports_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_exports_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_lines: {
        Row: {
          amount_pence: number
          created_at: string
          created_by_user_id: string | null
          description: string
          home_id: string
          hours: number | null
          id: string
          line_type: Database["public"]["Enums"]["payslip_line_type"]
          multiplier: number
          payslip_id: string
          rate_pence: number | null
          source_shift_ids: string[]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          amount_pence: number
          created_at?: string
          created_by_user_id?: string | null
          description: string
          home_id: string
          hours?: number | null
          id?: string
          line_type: Database["public"]["Enums"]["payslip_line_type"]
          multiplier?: number
          payslip_id: string
          rate_pence?: number | null
          source_shift_ids?: string[]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          amount_pence?: number
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          home_id?: string
          hours?: number | null
          id?: string
          line_type?: Database["public"]["Enums"]["payslip_line_type"]
          multiplier?: number
          payslip_id?: string
          rate_pence?: number | null
          source_shift_ids?: string[]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payslip_lines_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_lines_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_lines_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_lines_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          gross_bank_holiday_pence: number
          gross_christmas_pence: number
          gross_holiday_pence: number
          gross_night_pence: number
          gross_overtime_pence: number
          gross_sickness_pence: number
          gross_sleep_in_pence: number
          gross_total_pence: number
          gross_training_pence: number
          gross_weekday_pence: number
          gross_weekend_pence: number
          home_id: string
          id: string
          net_pay_pence: number
          ni_category: string | null
          ni_employee_pence: number
          ni_employer_pence: number
          pay_run_id: string
          paye_tax_pence: number
          pension_employee_pence: number
          pension_employer_pence: number
          staff_id: string
          statutory_payments_pence: number
          student_loan_pence: number
          tax_code: string | null
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          gross_bank_holiday_pence?: number
          gross_christmas_pence?: number
          gross_holiday_pence?: number
          gross_night_pence?: number
          gross_overtime_pence?: number
          gross_sickness_pence?: number
          gross_sleep_in_pence?: number
          gross_total_pence?: number
          gross_training_pence?: number
          gross_weekday_pence?: number
          gross_weekend_pence?: number
          home_id: string
          id?: string
          net_pay_pence?: number
          ni_category?: string | null
          ni_employee_pence?: number
          ni_employer_pence?: number
          pay_run_id: string
          paye_tax_pence?: number
          pension_employee_pence?: number
          pension_employer_pence?: number
          staff_id: string
          statutory_payments_pence?: number
          student_loan_pence?: number
          tax_code?: string | null
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          gross_bank_holiday_pence?: number
          gross_christmas_pence?: number
          gross_holiday_pence?: number
          gross_night_pence?: number
          gross_overtime_pence?: number
          gross_sickness_pence?: number
          gross_sleep_in_pence?: number
          gross_total_pence?: number
          gross_training_pence?: number
          gross_weekday_pence?: number
          gross_weekend_pence?: number
          home_id?: string
          id?: string
          net_pay_pence?: number
          ni_category?: string | null
          ni_employee_pence?: number
          ni_employer_pence?: number
          pay_run_id?: string
          paye_tax_pence?: number
          pension_employee_pence?: number
          pension_employer_pence?: number
          staff_id?: string
          statutory_payments_pence?: number
          student_loan_pence?: number
          tax_code?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_pay_run_id_fkey"
            columns: ["pay_run_id"]
            isOneToOne: false
            referencedRelation: "pay_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_documents: {
        Row: {
          chunk_count: number | null
          created_at: string
          created_by_user_id: string | null
          error_text: string | null
          file_size_bytes: number | null
          filename: string
          home_id: string
          id: string
          mime_type: string
          status: string
          storage_path: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          chunk_count?: number | null
          created_at?: string
          created_by_user_id?: string | null
          error_text?: string | null
          file_size_bytes?: number | null
          filename: string
          home_id: string
          id?: string
          mime_type?: string
          status?: string
          storage_path: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          chunk_count?: number | null
          created_at?: string
          created_by_user_id?: string | null
          error_text?: string | null
          file_size_bytes?: number | null
          filename?: string
          home_id?: string
          id?: string
          mime_type?: string
          status?: string
          storage_path?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policy_documents_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_documents_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_documents_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      premium_pay_calendar: {
        Row: {
          calendar_date: string
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          multiplier: number
          name: string
          source: Database["public"]["Enums"]["premium_pay_source"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          calendar_date: string
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          multiplier?: number
          name: string
          source?: Database["public"]["Enums"]["premium_pay_source"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          calendar_date?: string
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          multiplier?: number
          name?: string
          source?: Database["public"]["Enums"]["premium_pay_source"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "premium_pay_calendar_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_pay_calendar_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premium_pay_calendar_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rag_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          created_by_user_id: string | null
          embedding: string | null
          home_id: string
          id: string
          source_id: string
          source_type: string
          tenant_id: string
          token_count: number | null
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          created_by_user_id?: string | null
          embedding?: string | null
          home_id: string
          id?: string
          source_id: string
          source_type: string
          tenant_id: string
          token_count?: number | null
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          created_by_user_id?: string | null
          embedding?: string | null
          home_id?: string
          id?: string
          source_id?: string
          source_type?: string
          tenant_id?: string
          token_count?: number | null
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rag_chunks_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_chunks_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rag_chunks_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rebalance_suggestions: {
        Row: {
          cost_impact_pence: number
          created_at: string
          created_by_user_id: string | null
          dismissed_reason: string | null
          home_id: string
          id: string
          proposed_changes: Json | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          shift_ids_affected: string[]
          status: string
          summary: string
          tenant_id: string
          trigger_entity_id: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          cost_impact_pence?: number
          created_at?: string
          created_by_user_id?: string | null
          dismissed_reason?: string | null
          home_id: string
          id?: string
          proposed_changes?: Json | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          shift_ids_affected?: string[]
          status?: string
          summary: string
          tenant_id: string
          trigger_entity_id?: string | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          cost_impact_pence?: number
          created_at?: string
          created_by_user_id?: string | null
          dismissed_reason?: string | null
          home_id?: string
          id?: string
          proposed_changes?: Json | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          shift_ids_affected?: string[]
          status?: string
          summary?: string
          tenant_id?: string
          trigger_entity_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rebalance_suggestions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rebalance_suggestions_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rebalance_suggestions_resolved_by_user_id_fkey"
            columns: ["resolved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_wage_rates: {
        Row: {
          age_band: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          label: string
          rate_pence: number
        }
        Insert: {
          age_band: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          label: string
          rate_pence: number
        }
        Update: {
          age_band?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          label?: string
          rate_pence?: number
        }
        Relationships: []
      }
      residents: {
        Row: {
          admission_date: string | null
          created_at: string
          created_by_user_id: string | null
          discharge_date: string | null
          external_resident_ref: string | null
          first_name: string
          home_id: string
          id: string
          last_name_initial: string | null
          notes: string | null
          room_number: string | null
          source: Database["public"]["Enums"]["dependency_source"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          admission_date?: string | null
          created_at?: string
          created_by_user_id?: string | null
          discharge_date?: string | null
          external_resident_ref?: string | null
          first_name: string
          home_id: string
          id?: string
          last_name_initial?: string | null
          notes?: string | null
          room_number?: string | null
          source?: Database["public"]["Enums"]["dependency_source"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          admission_date?: string | null
          created_at?: string
          created_by_user_id?: string | null
          discharge_date?: string | null
          external_resident_ref?: string | null
          first_name?: string
          home_id?: string
          id?: string
          last_name_initial?: string | null
          notes?: string | null
          room_number?: string | null
          source?: Database["public"]["Enums"]["dependency_source"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "residents_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "residents_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_generation_audit: {
        Row: {
          candidates_evaluated: number
          generated_at: string
          generated_by_user_id: string | null
          home_id: string
          id: string
          ranking_json: Json | null
          rota_period_id: string
          selected_reason: string | null
          shift_id: string
          staff_id: string | null
          tenant_id: string
        }
        Insert: {
          candidates_evaluated?: number
          generated_at?: string
          generated_by_user_id?: string | null
          home_id: string
          id?: string
          ranking_json?: Json | null
          rota_period_id: string
          selected_reason?: string | null
          shift_id: string
          staff_id?: string | null
          tenant_id: string
        }
        Update: {
          candidates_evaluated?: number
          generated_at?: string
          generated_by_user_id?: string | null
          home_id?: string
          id?: string
          ranking_json?: Json | null
          rota_period_id?: string
          selected_reason?: string | null
          shift_id?: string
          staff_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_generation_audit_generated_by_user_id_fkey"
            columns: ["generated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_generation_audit_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_generation_audit_rota_period_id_fkey"
            columns: ["rota_period_id"]
            isOneToOne: false
            referencedRelation: "rota_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_generation_audit_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_generation_audit_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_history: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          end_time_local: string
          home_id: string
          id: string
          import_batch_id: string
          role_code: string | null
          shift_date: string
          source_file: string | null
          staff_id: string | null
          staff_name: string
          start_time_local: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          end_time_local: string
          home_id: string
          id?: string
          import_batch_id: string
          role_code?: string | null
          shift_date: string
          source_file?: string | null
          staff_id?: string | null
          staff_name: string
          start_time_local: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          end_time_local?: string
          home_id?: string
          id?: string
          import_batch_id?: string
          role_code?: string | null
          shift_date?: string
          source_file?: string | null
          staff_id?: string | null
          staff_name?: string
          start_time_local?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_history_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_history_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_history_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_periods: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          period_end_date: string
          period_start_date: string
          published_at: string | null
          published_by_user_id: string | null
          status: Database["public"]["Enums"]["rota_period_state"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          period_end_date: string
          period_start_date: string
          published_at?: string | null
          published_by_user_id?: string | null
          status?: Database["public"]["Enums"]["rota_period_state"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          period_end_date?: string
          period_start_date?: string
          published_at?: string | null
          published_by_user_id?: string | null
          status?: Database["public"]["Enums"]["rota_period_state"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rota_periods_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_periods_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_periods_published_by_user_id_fkey"
            columns: ["published_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_periods_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_slot_requirements: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          day_of_week: number
          headcount_required: number
          home_id: string
          id: string
          role_code: string
          shift_pattern_template_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          day_of_week: number
          headcount_required?: number
          home_id: string
          id?: string
          role_code: string
          shift_pattern_template_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          day_of_week?: number
          headcount_required?: number
          home_id?: string
          id?: string
          role_code?: string
          shift_pattern_template_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rota_slot_requirements_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_slot_requirements_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_slot_requirements_shift_pattern_template_id_fkey"
            columns: ["shift_pattern_template_id"]
            isOneToOne: false
            referencedRelation: "shift_pattern_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_slot_requirements_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_override_reviews: {
        Row: {
          comments: string | null
          created_at: string
          home_id: string
          id: string
          override_ids_reviewed: string[]
          period_end: string
          period_start: string
          reviewed_at: string
          reviewer_user_id: string
          tenant_id: string
        }
        Insert: {
          comments?: string | null
          created_at?: string
          home_id: string
          id?: string
          override_ids_reviewed?: string[]
          period_end: string
          period_start: string
          reviewed_at?: string
          reviewer_user_id: string
          tenant_id: string
        }
        Update: {
          comments?: string | null
          created_at?: string
          home_id?: string
          id?: string
          override_ids_reviewed?: string[]
          period_end?: string
          period_start?: string
          reviewed_at?: string
          reviewer_user_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_override_reviews_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_override_reviews_reviewer_user_id_fkey"
            columns: ["reviewer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_overrides: {
        Row: {
          after_state_json: Json | null
          before_state_json: Json | null
          blocked_action: string
          created_at: string
          entity_id: string
          entity_type: string
          home_id: string
          id: string
          justification: string
          mfa_method: Database["public"]["Enums"]["mfa_method"]
          overridden_at: string
          overridden_by_user_id: string
          reason_category: string
          rule_code: string
          tenant_id: string
        }
        Insert: {
          after_state_json?: Json | null
          before_state_json?: Json | null
          blocked_action: string
          created_at?: string
          entity_id: string
          entity_type: string
          home_id: string
          id?: string
          justification: string
          mfa_method: Database["public"]["Enums"]["mfa_method"]
          overridden_at?: string
          overridden_by_user_id: string
          reason_category: string
          rule_code: string
          tenant_id: string
        }
        Update: {
          after_state_json?: Json | null
          before_state_json?: Json | null
          blocked_action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          home_id?: string
          id?: string
          justification?: string
          mfa_method?: Database["public"]["Enums"]["mfa_method"]
          overridden_at?: string
          overridden_by_user_id?: string
          reason_category?: string
          rule_code?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rule_overrides_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rule_overrides_overridden_by_user_id_fkey"
            columns: ["overridden_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_clockings: {
        Row: {
          capture_method: Database["public"]["Enums"]["capture_method"]
          created_at: string
          created_by_user_id: string | null
          event_time_utc: string
          event_type: Database["public"]["Enums"]["clocking_event_type"]
          gps_accuracy_metres: number | null
          home_id: string
          id: string
          kiosk_id: string | null
          lat: number | null
          lng: number | null
          nfc_uid: string | null
          offline_queued: boolean
          offline_synced_at: string | null
          photo_expires_at: string | null
          photo_url: string | null
          pin_match: boolean | null
          requires_review: boolean
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          shift_id: string | null
          staff_id: string | null
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          capture_method: Database["public"]["Enums"]["capture_method"]
          created_at?: string
          created_by_user_id?: string | null
          event_time_utc: string
          event_type: Database["public"]["Enums"]["clocking_event_type"]
          gps_accuracy_metres?: number | null
          home_id: string
          id?: string
          kiosk_id?: string | null
          lat?: number | null
          lng?: number | null
          nfc_uid?: string | null
          offline_queued?: boolean
          offline_synced_at?: string | null
          photo_expires_at?: string | null
          photo_url?: string | null
          pin_match?: boolean | null
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          shift_id?: string | null
          staff_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          capture_method?: Database["public"]["Enums"]["capture_method"]
          created_at?: string
          created_by_user_id?: string | null
          event_time_utc?: string
          event_type?: Database["public"]["Enums"]["clocking_event_type"]
          gps_accuracy_metres?: number | null
          home_id?: string
          id?: string
          kiosk_id?: string | null
          lat?: number | null
          lng?: number | null
          nfc_uid?: string | null
          offline_queued?: boolean
          offline_synced_at?: string | null
          photo_expires_at?: string | null
          photo_url?: string | null
          pin_match?: boolean | null
          requires_review?: boolean
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          shift_id?: string | null
          staff_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_clocking_kiosk"
            columns: ["kiosk_id"]
            isOneToOne: false
            referencedRelation: "kiosks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_clockings_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_clockings_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_clockings_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_clockings_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_clockings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_clockings_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_pattern_templates: {
        Row: {
          break_minutes: number
          created_at: string
          created_by_user_id: string | null
          end_time_local: string
          home_id: string
          id: string
          length_type: Database["public"]["Enums"]["shift_length_type"]
          name: string
          paid_hours_decimal: number
          start_time_local: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          created_by_user_id?: string | null
          end_time_local: string
          home_id: string
          id?: string
          length_type?: Database["public"]["Enums"]["shift_length_type"]
          name: string
          paid_hours_decimal: number
          start_time_local: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          break_minutes?: number
          created_at?: string
          created_by_user_id?: string | null
          end_time_local?: string
          home_id?: string
          id?: string
          length_type?: Database["public"]["Enums"]["shift_length_type"]
          name?: string
          paid_hours_decimal?: number
          start_time_local?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_pattern_templates_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_pattern_templates_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_pattern_templates_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_slots: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          date: string
          dependency_required_score: number | null
          headcount_required: number
          home_id: string
          id: string
          notes: string | null
          role_code: string
          rota_period_id: string
          shift_pattern_template_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          date: string
          dependency_required_score?: number | null
          headcount_required?: number
          home_id: string
          id?: string
          notes?: string | null
          role_code: string
          rota_period_id: string
          shift_pattern_template_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          date?: string
          dependency_required_score?: number | null
          headcount_required?: number
          home_id?: string
          id?: string
          notes?: string | null
          role_code?: string
          rota_period_id?: string
          shift_pattern_template_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_slots_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_slots_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_slots_rota_period_id_fkey"
            columns: ["rota_period_id"]
            isOneToOne: false
            referencedRelation: "rota_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_slots_shift_pattern_template_id_fkey"
            columns: ["shift_pattern_template_id"]
            isOneToOne: false
            referencedRelation: "shift_pattern_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_slots_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swaps: {
        Row: {
          approver_user_id: string | null
          created_at: string
          created_by_user_id: string | null
          decided_at: string | null
          home_id: string
          id: string
          original_shift_id: string
          requested_with_staff_id: string
          status: Database["public"]["Enums"]["shift_swap_status"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          approver_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          decided_at?: string | null
          home_id: string
          id?: string
          original_shift_id: string
          requested_with_staff_id: string
          status?: Database["public"]["Enums"]["shift_swap_status"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          approver_user_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          decided_at?: string | null
          home_id?: string
          id?: string
          original_shift_id?: string
          requested_with_staff_id?: string
          status?: Database["public"]["Enums"]["shift_swap_status"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_swaps_approver_user_id_fkey"
            columns: ["approver_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_original_shift_id_fkey"
            columns: ["original_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_requested_with_staff_id_fkey"
            columns: ["requested_with_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swaps_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          agency_supplier_id: string | null
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          is_bank_holiday: boolean
          is_chef: boolean
          is_christmas_period: boolean
          is_fire_warden: boolean
          is_medicine_manager: boolean
          is_responsible_nurse: boolean
          planned_break_minutes: number
          planned_end_utc: string
          planned_paid_hours: number
          planned_start_utc: string
          premium_multiplier: number
          shift_slot_id: string
          staff_id: string | null
          state: Database["public"]["Enums"]["shift_state"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          agency_supplier_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          is_bank_holiday?: boolean
          is_chef?: boolean
          is_christmas_period?: boolean
          is_fire_warden?: boolean
          is_medicine_manager?: boolean
          is_responsible_nurse?: boolean
          planned_break_minutes?: number
          planned_end_utc: string
          planned_paid_hours: number
          planned_start_utc: string
          premium_multiplier?: number
          shift_slot_id: string
          staff_id?: string | null
          state?: Database["public"]["Enums"]["shift_state"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          agency_supplier_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          is_bank_holiday?: boolean
          is_chef?: boolean
          is_christmas_period?: boolean
          is_fire_warden?: boolean
          is_medicine_manager?: boolean
          is_responsible_nurse?: boolean
          planned_break_minutes?: number
          planned_end_utc?: string
          planned_paid_hours?: number
          planned_start_utc?: string
          premium_multiplier?: number
          shift_slot_id?: string
          staff_id?: string | null
          state?: Database["public"]["Enums"]["shift_state"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_shift_slot_id_fkey"
            columns: ["shift_slot_id"]
            isOneToOne: false
            referencedRelation: "shift_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts_actual: {
        Row: {
          actual_break_minutes: number
          actual_end_utc: string | null
          actual_start_utc: string | null
          actual_worked_minutes: number | null
          clockings_count: number
          created_at: string
          created_by_user_id: string | null
          disturbed_minutes: number
          home_id: string
          id: string
          last_reconciled_at: string | null
          manager_note: string | null
          reconciliation_resolved_by_user_id: string | null
          reconciliation_status: Database["public"]["Enums"]["reconciliation_state"]
          shift_id: string
          staff_id: string | null
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          actual_break_minutes?: number
          actual_end_utc?: string | null
          actual_start_utc?: string | null
          actual_worked_minutes?: number | null
          clockings_count?: number
          created_at?: string
          created_by_user_id?: string | null
          disturbed_minutes?: number
          home_id: string
          id?: string
          last_reconciled_at?: string | null
          manager_note?: string | null
          reconciliation_resolved_by_user_id?: string | null
          reconciliation_status?: Database["public"]["Enums"]["reconciliation_state"]
          shift_id: string
          staff_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          actual_break_minutes?: number
          actual_end_utc?: string | null
          actual_start_utc?: string | null
          actual_worked_minutes?: number | null
          clockings_count?: number
          created_at?: string
          created_by_user_id?: string | null
          disturbed_minutes?: number
          home_id?: string
          id?: string
          last_reconciled_at?: string | null
          manager_note?: string | null
          reconciliation_resolved_by_user_id?: string | null
          reconciliation_status?: Database["public"]["Enums"]["reconciliation_state"]
          shift_id?: string
          staff_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_actual_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_actual_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_actual_reconciliation_resolved_by_user_id_fkey"
            columns: ["reconciliation_resolved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_actual_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: true
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_actual_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_actual_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts_payable: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          finalized_at: string | null
          home_id: string
          id: string
          manager_override_reason: string | null
          paid_minutes_bank_holiday: number
          paid_minutes_christmas: number
          paid_minutes_disturbed: number
          paid_minutes_holiday: number
          paid_minutes_night: number
          paid_minutes_overtime: number
          paid_minutes_sickness: number
          paid_minutes_sleep_in: number
          paid_minutes_training: number
          paid_minutes_weekday: number
          paid_minutes_weekend: number
          pay_run_id: string | null
          premium_multiplier_applied: number
          reconciliation_state:
            | Database["public"]["Enums"]["reconciliation_state"]
            | null
          shift_id: string
          shifts_actual_id: string | null
          source_rule: string
          staff_id: string | null
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          finalized_at?: string | null
          home_id: string
          id?: string
          manager_override_reason?: string | null
          paid_minutes_bank_holiday?: number
          paid_minutes_christmas?: number
          paid_minutes_disturbed?: number
          paid_minutes_holiday?: number
          paid_minutes_night?: number
          paid_minutes_overtime?: number
          paid_minutes_sickness?: number
          paid_minutes_sleep_in?: number
          paid_minutes_training?: number
          paid_minutes_weekday?: number
          paid_minutes_weekend?: number
          pay_run_id?: string | null
          premium_multiplier_applied?: number
          reconciliation_state?:
            | Database["public"]["Enums"]["reconciliation_state"]
            | null
          shift_id: string
          shifts_actual_id?: string | null
          source_rule: string
          staff_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          finalized_at?: string | null
          home_id?: string
          id?: string
          manager_override_reason?: string | null
          paid_minutes_bank_holiday?: number
          paid_minutes_christmas?: number
          paid_minutes_disturbed?: number
          paid_minutes_holiday?: number
          paid_minutes_night?: number
          paid_minutes_overtime?: number
          paid_minutes_sickness?: number
          paid_minutes_sleep_in?: number
          paid_minutes_training?: number
          paid_minutes_weekday?: number
          paid_minutes_weekend?: number
          pay_run_id?: string | null
          premium_multiplier_applied?: number
          reconciliation_state?:
            | Database["public"]["Enums"]["reconciliation_state"]
            | null
          shift_id?: string
          shifts_actual_id?: string | null
          source_rule?: string
          staff_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_payable_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_payable_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_payable_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: true
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_payable_shifts_actual_id_fkey"
            columns: ["shifts_actual_id"]
            isOneToOne: false
            referencedRelation: "shifts_actual"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_payable_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_payable_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sickness_episodes: {
        Row: {
          contractual_pay_applied: boolean
          covering_strategy: Database["public"]["Enums"]["covering_strategy"]
          created_at: string
          created_by_user_id: string | null
          first_day_of_sickness: string
          fit_note_url: string | null
          home_id: string
          id: string
          last_day_of_sickness: string | null
          qualifying_days: number | null
          return_to_work_completed_at: string | null
          ssp_eligible: boolean
          staff_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          contractual_pay_applied?: boolean
          covering_strategy?: Database["public"]["Enums"]["covering_strategy"]
          created_at?: string
          created_by_user_id?: string | null
          first_day_of_sickness: string
          fit_note_url?: string | null
          home_id: string
          id?: string
          last_day_of_sickness?: string | null
          qualifying_days?: number | null
          return_to_work_completed_at?: string | null
          ssp_eligible?: boolean
          staff_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          contractual_pay_applied?: boolean
          covering_strategy?: Database["public"]["Enums"]["covering_strategy"]
          created_at?: string
          created_by_user_id?: string | null
          first_day_of_sickness?: string
          fit_note_url?: string | null
          home_id?: string
          id?: string
          last_day_of_sickness?: string | null
          qualifying_days?: number | null
          return_to_work_completed_at?: string | null
          ssp_eligible?: boolean
          staff_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sickness_episodes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sickness_episodes_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sickness_episodes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sickness_episodes_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          address: string | null
          created_at: string
          created_by_user_id: string | null
          date_left: string | null
          date_of_birth: string | null
          date_started: string | null
          emergency_contact: Json | null
          employee_number: string | null
          first_name: string
          home_id: string
          id: string
          last_name: string
          ni_number: string | null
          overtime_eligible: boolean
          overtime_weighting: number
          photo_url: string | null
          status: Database["public"]["Enums"]["staff_status"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by_user_id?: string | null
          date_left?: string | null
          date_of_birth?: string | null
          date_started?: string | null
          emergency_contact?: Json | null
          employee_number?: string | null
          first_name: string
          home_id: string
          id?: string
          last_name: string
          ni_number?: string | null
          overtime_eligible?: boolean
          overtime_weighting?: number
          photo_url?: string | null
          status?: Database["public"]["Enums"]["staff_status"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by_user_id?: string | null
          date_left?: string | null
          date_of_birth?: string | null
          date_started?: string | null
          emergency_contact?: Json | null
          employee_number?: string | null
          first_name?: string
          home_id?: string
          id?: string
          last_name?: string
          ni_number?: string | null
          overtime_eligible?: boolean
          overtime_weighting?: number
          photo_url?: string | null
          status?: Database["public"]["Enums"]["staff_status"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_contracts: {
        Row: {
          contract_type: Database["public"]["Enums"]["contract_type"]
          contracted_days_per_week: number | null
          contracted_hours_per_week: number
          created_at: string
          created_by_user_id: string | null
          effective_from: string
          effective_to: string | null
          holiday_accrual_model: string
          holiday_entitlement_value: number
          holiday_unit_override:
            | Database["public"]["Enums"]["allocation_unit"]
            | null
          home_id: string
          id: string
          shift_pattern_preference: Database["public"]["Enums"]["shift_pattern_preference"]
          sick_pay_scheme_id: string | null
          staff_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          contract_type: Database["public"]["Enums"]["contract_type"]
          contracted_days_per_week?: number | null
          contracted_hours_per_week?: number
          created_at?: string
          created_by_user_id?: string | null
          effective_from: string
          effective_to?: string | null
          holiday_accrual_model?: string
          holiday_entitlement_value?: number
          holiday_unit_override?:
            | Database["public"]["Enums"]["allocation_unit"]
            | null
          home_id: string
          id?: string
          shift_pattern_preference?: Database["public"]["Enums"]["shift_pattern_preference"]
          sick_pay_scheme_id?: string | null
          staff_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          contract_type?: Database["public"]["Enums"]["contract_type"]
          contracted_days_per_week?: number | null
          contracted_hours_per_week?: number
          created_at?: string
          created_by_user_id?: string | null
          effective_from?: string
          effective_to?: string | null
          holiday_accrual_model?: string
          holiday_entitlement_value?: number
          holiday_unit_override?:
            | Database["public"]["Enums"]["allocation_unit"]
            | null
          home_id?: string
          id?: string
          shift_pattern_preference?: Database["public"]["Enums"]["shift_pattern_preference"]
          sick_pay_scheme_id?: string | null
          staff_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_contracts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_contracts_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_contracts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_contracts_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_documents: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number: string | null
          expiry_date: string | null
          file_url: string | null
          home_id: string
          id: string
          issue_date: string | null
          staff_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          verified_at: string | null
          verified_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          doc_type: Database["public"]["Enums"]["document_type"]
          document_number?: string | null
          expiry_date?: string | null
          file_url?: string | null
          home_id: string
          id?: string
          issue_date?: string | null
          staff_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          doc_type?: Database["public"]["Enums"]["document_type"]
          document_number?: string | null
          expiry_date?: string | null
          file_url?: string | null
          home_id?: string
          id?: string
          issue_date?: string | null
          staff_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          verified_at?: string | null
          verified_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_verified_by_user_id_fkey"
            columns: ["verified_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_fixed_shifts: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          day_of_week: number
          effective_from: string
          effective_to: string | null
          home_id: string
          id: string
          shift_template_id: string
          staff_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          day_of_week: number
          effective_from: string
          effective_to?: string | null
          home_id: string
          id?: string
          shift_template_id: string
          staff_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          day_of_week?: number
          effective_from?: string
          effective_to?: string | null
          home_id?: string
          id?: string
          shift_template_id?: string
          staff_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_fixed_shifts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_fixed_shifts_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_fixed_shifts_shift_template_id_fkey"
            columns: ["shift_template_id"]
            isOneToOne: false
            referencedRelation: "shift_pattern_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_fixed_shifts_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_fixed_shifts_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_kiosk_pins: {
        Row: {
          attempts: number
          created_at: string
          created_by_user_id: string | null
          home_id: string
          last_reset_at: string | null
          pin_hash: string
          pin_locked_at: string | null
          staff_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          last_reset_at?: string | null
          pin_hash: string
          pin_locked_at?: string | null
          staff_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          last_reset_at?: string | null
          pin_hash?: string
          pin_locked_at?: string | null
          staff_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_kiosk_pins_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_kiosk_pins_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_kiosk_pins_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_kiosk_pins_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_pay_rates: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          effective_from: string
          effective_to: string | null
          home_id: string
          id: string
          rate_night_pence: number
          rate_overtime_pence: number
          rate_sleep_in_flat_pence: number
          rate_training_pence: number
          rate_weekday_pence: number
          rate_weekend_pence: number
          role_code: string
          staff_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          effective_from: string
          effective_to?: string | null
          home_id: string
          id?: string
          rate_night_pence: number
          rate_overtime_pence: number
          rate_sleep_in_flat_pence?: number
          rate_training_pence: number
          rate_weekday_pence: number
          rate_weekend_pence: number
          role_code: string
          staff_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          effective_from?: string
          effective_to?: string | null
          home_id?: string
          id?: string
          rate_night_pence?: number
          rate_overtime_pence?: number
          rate_sleep_in_flat_pence?: number
          rate_training_pence?: number
          rate_weekday_pence?: number
          rate_weekend_pence?: number
          role_code?: string
          staff_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_pay_rates_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_pay_rates_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_pay_rates_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_pay_rates_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          code: string
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          name: string
          requires_dbs: boolean
          requires_nurse_pin: boolean
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          name: string
          requires_dbs?: boolean
          requires_nurse_pin?: boolean
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          name?: string
          requires_dbs?: boolean
          requires_nurse_pin?: boolean
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_sponsorship: {
        Row: {
          cos_end_date: string
          cos_reference: string
          cos_start_date: string
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          minimum_hours_per_week: number
          notes: string | null
          route: string
          sponsor_licence_number: string
          staff_id: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          cos_end_date: string
          cos_reference: string
          cos_start_date: string
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          minimum_hours_per_week: number
          notes?: string | null
          route: string
          sponsor_licence_number: string
          staff_id: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          cos_end_date?: string
          cos_reference?: string
          cos_start_date?: string
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          minimum_hours_per_week?: number
          notes?: string | null
          route?: string
          sponsor_licence_number?: string
          staff_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_sponsorship_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_sponsorship_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_sponsorship_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_sponsorship_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_training_attendances: {
        Row: {
          attended: boolean
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          minutes_outside_shift_payable: number
          minutes_overlapping_shift: number
          notes: string | null
          overlap_shift_id: string | null
          paid_status: Database["public"]["Enums"]["paid_status"]
          session_end_utc: string
          session_start_utc: string
          staff_id: string
          tenant_id: string
          training_topic_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          attended?: boolean
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          minutes_outside_shift_payable?: number
          minutes_overlapping_shift?: number
          notes?: string | null
          overlap_shift_id?: string | null
          paid_status?: Database["public"]["Enums"]["paid_status"]
          session_end_utc: string
          session_start_utc: string
          staff_id: string
          tenant_id: string
          training_topic_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          attended?: boolean
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          minutes_outside_shift_payable?: number
          minutes_overlapping_shift?: number
          notes?: string | null
          overlap_shift_id?: string | null
          paid_status?: Database["public"]["Enums"]["paid_status"]
          session_end_utc?: string
          session_start_utc?: string
          staff_id?: string
          tenant_id?: string
          training_topic_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_training_attendance_shift"
            columns: ["overlap_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_training_attendances_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_training_attendances_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_training_attendances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_training_attendances_training_topic_id_fkey"
            columns: ["training_topic_id"]
            isOneToOne: false
            referencedRelation: "training_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_training_attendances_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_training_certs: {
        Row: {
          certificate_url: string | null
          created_at: string
          created_by_user_id: string | null
          expiry_date: string | null
          home_id: string
          id: string
          issue_date: string
          source: string
          staff_id: string
          tenant_id: string
          training_topic_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          certificate_url?: string | null
          created_at?: string
          created_by_user_id?: string | null
          expiry_date?: string | null
          home_id: string
          id?: string
          issue_date: string
          source?: string
          staff_id: string
          tenant_id: string
          training_topic_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          certificate_url?: string | null
          created_at?: string
          created_by_user_id?: string | null
          expiry_date?: string | null
          home_id?: string
          id?: string
          issue_date?: string
          source?: string
          staff_id?: string
          tenant_id?: string
          training_topic_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_training_certs_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_training_certs_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_training_certs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_training_certs_training_topic_id_fkey"
            columns: ["training_topic_id"]
            isOneToOne: false
            referencedRelation: "training_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_training_certs_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_matrices: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          high_dep_threshold: number
          home_id: string
          id: string
          low_dep_threshold: number
          medium_dep_threshold: number
          min_ancillary: number
          min_carers: number
          min_nurses: number
          min_senior_carers: number
          name: string
          one_to_one_factor: number
          shift_block: string
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          high_dep_threshold?: number
          home_id: string
          id?: string
          low_dep_threshold?: number
          medium_dep_threshold?: number
          min_ancillary?: number
          min_carers?: number
          min_nurses?: number
          min_senior_carers?: number
          name: string
          one_to_one_factor?: number
          shift_block: string
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          high_dep_threshold?: number
          home_id?: string
          id?: string
          low_dep_threshold?: number
          medium_dep_threshold?: number
          min_ancillary?: number
          min_carers?: number
          min_nurses?: number
          min_senior_carers?: number
          name?: string
          one_to_one_factor?: number
          shift_block?: string
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staffing_matrices_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_matrices_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staffing_matrices_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      statutory_payment_records: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          home_id: string
          id: string
          payment_type: Database["public"]["Enums"]["statutory_payment_type"]
          period_end: string
          period_start: string
          staff_id: string
          tenant_id: string
          total_pence: number
          updated_at: string
          updated_by_user_id: string | null
          weekly_rate_pence: number
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          home_id: string
          id?: string
          payment_type: Database["public"]["Enums"]["statutory_payment_type"]
          period_end: string
          period_start: string
          staff_id: string
          tenant_id: string
          total_pence: number
          updated_at?: string
          updated_by_user_id?: string | null
          weekly_rate_pence: number
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          home_id?: string
          id?: string
          payment_type?: Database["public"]["Enums"]["statutory_payment_type"]
          period_end?: string
          period_start?: string
          staff_id?: string
          tenant_id?: string
          total_pence?: number
          updated_at?: string
          updated_by_user_id?: string | null
          weekly_rate_pence?: number
        }
        Relationships: [
          {
            foreignKeyName: "statutory_payment_records_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statutory_payment_records_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statutory_payment_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statutory_payment_records_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      training_topics: {
        Row: {
          applies_to_role_codes: string[]
          code: string
          created_at: string
          created_by_user_id: string | null
          enforcement_mode: string
          home_id: string
          id: string
          name: string
          renewal_interval_months: number
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          applies_to_role_codes?: string[]
          code: string
          created_at?: string
          created_by_user_id?: string | null
          enforcement_mode?: string
          home_id: string
          id?: string
          name: string
          renewal_interval_months: number
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          applies_to_role_codes?: string[]
          code?: string
          created_at?: string
          created_by_user_id?: string | null
          enforcement_mode?: string
          home_id?: string
          id?: string
          name?: string
          renewal_interval_months?: number
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_topics_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_topics_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_topics_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_home_roles: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          granted_at: string
          granted_by_user_id: string | null
          home_id: string | null
          id: string
          organisation_id: string
          revoked_at: string | null
          role_code: Database["public"]["Enums"]["role_code"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          granted_at?: string
          granted_by_user_id?: string | null
          home_id?: string | null
          id?: string
          organisation_id: string
          revoked_at?: string | null
          role_code: Database["public"]["Enums"]["role_code"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          granted_at?: string
          granted_by_user_id?: string | null
          home_id?: string | null
          id?: string
          organisation_id?: string
          revoked_at?: string | null
          role_code?: Database["public"]["Enums"]["role_code"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_home_roles_granted_by_user_id_fkey"
            columns: ["granted_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_home_roles_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_home_roles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_home_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          active_home_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_home_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_home_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_active_home_id_fkey"
            columns: ["active_home_id"]
            isOneToOne: false
            referencedRelation: "homes"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          email: string
          id: string
          name: string
          organisation_id: string
          status: Database["public"]["Enums"]["user_status"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          email: string
          id: string
          name?: string
          organisation_id: string
          status?: Database["public"]["Enums"]["user_status"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          email?: string
          id?: string
          name?: string
          organisation_id?: string
          status?: Database["public"]["Enums"]["user_status"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      set_active_home: { Args: { p_home_id: string }; Returns: undefined }
      uuid_generate_v7: { Args: never; Returns: string }
    }
    Enums: {
      allocation_unit: "days" | "hours"
      bank_holiday_region: "eng_wales" | "scotland" | "ni"
      bed_status: "occupied" | "vacant" | "reserved" | "maintenance"
      capture_method:
        | "kiosk_pin"
        | "nfc_badge"
        | "mobile_gps"
        | "manager_entry"
        | "imported_legacy"
        | "kiosk_nfc"
      chat_role: "user" | "assistant" | "tool"
      chat_session_status: "active" | "archived"
      clocking_event_type:
        | "clock_in"
        | "clock_out"
        | "disturbed_start"
        | "disturbed_end"
      contract_type: "full_time" | "part_time" | "bank" | "zero_hours"
      covering_strategy: "rebalance" | "agency" | "manager_cover" | "none"
      dependency_source:
        | "carerota_native"
        | "imported_from_carestream"
        | "manual_csv"
      document_type:
        | "passport"
        | "biometric_residence_permit"
        | "share_code"
        | "dbs_certificate"
        | "proof_of_address"
        | "training_certificate"
        | "fit_note"
        | "p45"
        | "p60"
        | "contract"
        | "other"
        | "nmc_pin"
        | "driving_licence"
      export_format:
        | "brightpay"
        | "sage"
        | "xero"
        | "moneysoft"
        | "iris"
        | "generic_csv"
        | "generic"
      leave_request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
        | "withdrawn"
      leave_type:
        | "annual"
        | "compassionate"
        | "maternity"
        | "paternity"
        | "shared_parental"
        | "adoption"
        | "unpaid"
        | "toil"
        | "other"
      mfa_method: "password_reentry" | "totp" | "webauthn"
      paid_status: "paid_top_up" | "no_top_up" | "skipped" | "partial"
      pay_frequency: "weekly" | "bi_weekly" | "four_weekly" | "monthly"
      pay_period_status: "open" | "processing" | "closed"
      pay_run_state:
        | "draft"
        | "pending_approval"
        | "approved"
        | "exported"
        | "void"
        | "in_review"
        | "locked"
      payable_source_rule:
        | "auto_actual"
        | "manager_override"
        | "pay_zero_no_show"
        | "pay_planned_override"
      payslip_line_type:
        | "basic_weekday"
        | "basic_weekend"
        | "bank_holiday"
        | "christmas"
        | "night"
        | "overtime"
        | "training"
        | "holiday"
        | "sickness"
        | "sleep_in"
        | "statutory_ssp"
        | "statutory_smp"
        | "statutory_spp"
        | "statutory_sap"
        | "statutory_shpp"
        | "pension_employee"
        | "pension_employer"
        | "paye_tax"
        | "ni_employee"
        | "ni_employer"
        | "student_loan"
      premium_pay_source: "auto_bank_holiday" | "manual"
      reconciliation_state:
        | "pending"
        | "matched"
        | "discrepancy"
        | "resolved"
        | "over_planned"
        | "under_planned"
        | "no_show"
        | "no_clock_out"
        | "manual_override"
      registration_type:
        | "residential"
        | "nursing"
        | "domiciliary"
        | "supported_living"
      role_code:
        | "super_admin"
        | "owner"
        | "registered_manager"
        | "deputy_manager"
        | "hr"
        | "accountant_readonly"
        | "staff"
        | "kiosk"
      rota_period_state: "draft" | "published" | "closed" | "archived"
      shift_length_type:
        | "long_day_12h"
        | "short_half_6h"
        | "sleep_in"
        | "custom"
      shift_pattern_preference: "any" | "day_only" | "night_only" | "days_and_nights" | "early_only" | "late_only" | "no_nights" | "no_weekends" | "fixed"
      shift_state:
        | "unassigned"
        | "assigned"
        | "in_progress"
        | "completed"
        | "no_show"
        | "cancelled"
      shift_swap_status: "pending" | "approved" | "rejected" | "cancelled"
      staff_status: "active" | "inactive" | "on_leave" | "maternity" | "paternity" | "shared_parental" | "adoption" | "long_term_sick" | "suspended" | "left"
      statutory_payment_type: "ssp" | "smp" | "spp" | "sap" | "shpp"
      user_status: "active" | "inactive" | "suspended" | "pending_invite"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      allocation_unit: ["days", "hours"],
      bank_holiday_region: ["eng_wales", "scotland", "ni"],
      bed_status: ["occupied", "vacant", "reserved", "maintenance"],
      capture_method: [
        "kiosk_pin",
        "nfc_badge",
        "mobile_gps",
        "manager_entry",
        "imported_legacy",
        "kiosk_nfc",
      ],
      chat_role: ["user", "assistant", "tool"],
      chat_session_status: ["active", "archived"],
      clocking_event_type: [
        "clock_in",
        "clock_out",
        "disturbed_start",
        "disturbed_end",
      ],
      contract_type: ["full_time", "part_time", "bank", "zero_hours"],
      covering_strategy: ["rebalance", "agency", "manager_cover", "none"],
      dependency_source: [
        "carerota_native",
        "imported_from_carestream",
        "manual_csv",
      ],
      document_type: [
        "passport",
        "biometric_residence_permit",
        "share_code",
        "dbs_certificate",
        "proof_of_address",
        "training_certificate",
        "fit_note",
        "p45",
        "p60",
        "contract",
        "other",
        "nmc_pin",
        "driving_licence",
      ],
      export_format: [
        "brightpay",
        "sage",
        "xero",
        "moneysoft",
        "iris",
        "generic_csv",
        "generic",
      ],
      leave_request_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "withdrawn",
      ],
      leave_type: [
        "annual",
        "compassionate",
        "maternity",
        "paternity",
        "shared_parental",
        "adoption",
        "unpaid",
        "toil",
        "other",
      ],
      mfa_method: ["password_reentry", "totp", "webauthn"],
      paid_status: ["paid_top_up", "no_top_up", "skipped", "partial"],
      pay_frequency: ["weekly", "bi_weekly", "four_weekly", "monthly"],
      pay_period_status: ["open", "processing", "closed"],
      pay_run_state: [
        "draft",
        "pending_approval",
        "approved",
        "exported",
        "void",
        "in_review",
        "locked",
      ],
      payable_source_rule: [
        "auto_actual",
        "manager_override",
        "pay_zero_no_show",
        "pay_planned_override",
      ],
      payslip_line_type: [
        "basic_weekday",
        "basic_weekend",
        "bank_holiday",
        "christmas",
        "night",
        "overtime",
        "training",
        "holiday",
        "sickness",
        "sleep_in",
        "statutory_ssp",
        "statutory_smp",
        "statutory_spp",
        "statutory_sap",
        "statutory_shpp",
        "pension_employee",
        "pension_employer",
        "paye_tax",
        "ni_employee",
        "ni_employer",
        "student_loan",
      ],
      premium_pay_source: ["auto_bank_holiday", "manual"],
      reconciliation_state: [
        "pending",
        "matched",
        "discrepancy",
        "resolved",
        "over_planned",
        "under_planned",
        "no_show",
        "no_clock_out",
        "manual_override",
      ],
      registration_type: [
        "residential",
        "nursing",
        "domiciliary",
        "supported_living",
      ],
      role_code: [
        "super_admin",
        "owner",
        "registered_manager",
        "deputy_manager",
        "hr",
        "accountant_readonly",
        "staff",
        "kiosk",
      ],
      rota_period_state: ["draft", "published", "closed", "archived"],
      shift_length_type: [
        "long_day_12h",
        "short_half_6h",
        "sleep_in",
        "custom",
      ],
      shift_pattern_preference: ["any", "day_only", "night_only", "days_and_nights", "early_only", "late_only", "no_nights", "no_weekends", "fixed"],
      shift_state: [
        "unassigned",
        "assigned",
        "in_progress",
        "completed",
        "no_show",
        "cancelled",
      ],
      shift_swap_status: ["pending", "approved", "rejected", "cancelled"],
      staff_status: ["active", "inactive", "on_leave", "maternity", "paternity", "shared_parental", "adoption", "long_term_sick", "suspended", "left"],
      statutory_payment_type: ["ssp", "smp", "spp", "sap", "shpp"],
      user_status: ["active", "inactive", "suspended", "pending_invite"],
    },
  },
} as const

