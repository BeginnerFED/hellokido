
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "app_admins": {
                  Row: {
                    "created_at": string,"created_by": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"app_settings": {
                  Row: {
                    "id": string,"key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "id"?: string,"key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "changed_at": string,"changed_by": string | null,"id": number,"new_row": Json | null,"old_row": Json | null,"operation": string,"row_id": string | null,"table_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: never,"new_row"?: Json | null,"old_row"?: Json | null,"operation": string,"row_id"?: string | null,"table_name": string
                  }
                  Update: {
                    "changed_at"?: string,"changed_by"?: string | null,"id"?: never,"new_row"?: Json | null,"old_row"?: Json | null,"operation"?: string,"row_id"?: string | null,"table_name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"event_participants": {
                  Row: {
                    "cancellation_date": string | null,"cancellation_reason": string | null,"created_at": string | null,"event_id": string,"id": string,"is_makeup": boolean | null,"makeup_for_id": string | null,"makeup_notes": string | null,"postponed_from_id": string | null,"postponed_notes": string | null,"postponed_to_id": string | null,"registration_id": string,"status": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cancellation_date"?: string | null,"cancellation_reason"?: string | null,"created_at"?: string | null,"event_id": string,"id"?: string,"is_makeup"?: boolean | null,"makeup_for_id"?: string | null,"makeup_notes"?: string | null,"postponed_from_id"?: string | null,"postponed_notes"?: string | null,"postponed_to_id"?: string | null,"registration_id": string,"status"?: string,"updated_at"?: string | null
                  }
                  Update: {
                    "cancellation_date"?: string | null,"cancellation_reason"?: string | null,"created_at"?: string | null,"event_id"?: string,"id"?: string,"is_makeup"?: boolean | null,"makeup_for_id"?: string | null,"makeup_notes"?: string | null,"postponed_from_id"?: string | null,"postponed_notes"?: string | null,"postponed_to_id"?: string | null,"registration_id"?: string,"status"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_participants_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_participants_makeup_for_id_fkey"
      columns: ["makeup_for_id"]
isOneToOne: false
      referencedRelation: "event_participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_participants_postponed_from_id_fkey"
      columns: ["postponed_from_id"]
isOneToOne: false
      referencedRelation: "event_participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_participants_postponed_to_id_fkey"
      columns: ["postponed_to_id"]
isOneToOne: false
      referencedRelation: "event_participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_participants_registration_id_fkey"
      columns: ["registration_id"]
isOneToOne: false
      referencedRelation: "registrations"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "age_group": string,"created_at": string | null,"current_capacity": number,"custom_description": string | null,"event_code": string | null,"event_date": string,"event_type": string,"id": string,"is_active": boolean | null,"max_capacity": number,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "age_group": string,"created_at"?: string | null,"current_capacity"?: number,"custom_description"?: string | null,"event_code"?: string | null,"event_date": string,"event_type": string,"id"?: string,"is_active"?: boolean | null,"max_capacity"?: number,"updated_at"?: string | null
                  }
                  Update: {
                    "age_group"?: string,"created_at"?: string | null,"current_capacity"?: number,"custom_description"?: string | null,"event_code"?: string | null,"event_date"?: string,"event_type"?: string,"id"?: string,"is_active"?: boolean | null,"max_capacity"?: number,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"expense_categories": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"is_system": boolean,"name_en": string,"name_tr": string,"name_uk": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"is_system"?: boolean,"name_en": string,"name_tr": string,"name_uk": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"is_system"?: boolean,"name_en"?: string,"name_tr"?: string,"name_uk"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"expenses": {
                  Row: {
                    "amount": number,"created_at": string | null,"description": string | null,"expense_date": string | null,"expense_type": string,"id": string,"notes": string | null,"payment_method": string,"recurring_expense_id": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string | null,"description"?: string | null,"expense_date"?: string | null,"expense_type": string,"id"?: string,"notes"?: string | null,"payment_method": string,"recurring_expense_id"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string | null,"description"?: string | null,"expense_date"?: string | null,"expense_type"?: string,"id"?: string,"notes"?: string | null,"payment_method"?: string,"recurring_expense_id"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "expenses_expense_type_fkey"
      columns: ["expense_type"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "expenses_recurring_expense_id_fkey"
      columns: ["recurring_expense_id"]
isOneToOne: false
      referencedRelation: "recurring_expenses"
      referencedColumns: ["id"]
    }
                  ]
                },"extension_history": {
                  Row: {
                    "added_extra_lessons": number,"created_at": string | null,"extension_date": string | null,"id": string,"new_end_date": string,"new_package_type": string,"new_start_date": string | null,"notes": string | null,"payment_amount": number | null,"payment_date": string | null,"payment_method": string,"payment_status": string,"previous_carried_lessons": number | null,"previous_end_date": string,"previous_extra_lessons": number,"previous_package_type": string,"previous_start_date": string | null,"registration_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_extra_lessons"?: number,"created_at"?: string | null,"extension_date"?: string | null,"id"?: string,"new_end_date": string,"new_package_type": string,"new_start_date"?: string | null,"notes"?: string | null,"payment_amount"?: number | null,"payment_date"?: string | null,"payment_method": string,"payment_status": string,"previous_carried_lessons"?: number | null,"previous_end_date": string,"previous_extra_lessons"?: number,"previous_package_type": string,"previous_start_date"?: string | null,"registration_id": string
                  }
                  Update: {
                    "added_extra_lessons"?: number,"created_at"?: string | null,"extension_date"?: string | null,"id"?: string,"new_end_date"?: string,"new_package_type"?: string,"new_start_date"?: string | null,"notes"?: string | null,"payment_amount"?: number | null,"payment_date"?: string | null,"payment_method"?: string,"payment_status"?: string,"previous_carried_lessons"?: number | null,"previous_end_date"?: string,"previous_extra_lessons"?: number,"previous_package_type"?: string,"previous_start_date"?: string | null,"registration_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "extension_history_registration_id_fkey"
      columns: ["registration_id"]
isOneToOne: false
      referencedRelation: "registrations"
      referencedColumns: ["id"]
    }
                  ]
                },"financial_records": {
                  Row: {
                    "amount": number,"created_at": string | null,"extension_history_id": string | null,"id": string,"notes": string | null,"payment_date": string | null,"payment_method": string,"payment_status": string,"registration_id": string,"transaction_date": string | null,"transaction_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string | null,"extension_history_id"?: string | null,"id"?: string,"notes"?: string | null,"payment_date"?: string | null,"payment_method": string,"payment_status": string,"registration_id": string,"transaction_date"?: string | null,"transaction_type": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string | null,"extension_history_id"?: string | null,"id"?: string,"notes"?: string | null,"payment_date"?: string | null,"payment_method"?: string,"payment_status"?: string,"registration_id"?: string,"transaction_date"?: string | null,"transaction_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "financial_records_extension_history_id_fkey"
      columns: ["extension_history_id"]
isOneToOne: false
      referencedRelation: "extension_history"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_records_registration_id_fkey"
      columns: ["registration_id"]
isOneToOne: false
      referencedRelation: "registrations"
      referencedColumns: ["id"]
    }
                  ]
                },"income_categories": {
                  Row: {
                    "code": string,"created_at": string,"id": string,"is_active": boolean,"is_system": boolean,"name_en": string,"name_tr": string,"name_uk": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"is_system"?: boolean,"name_en": string,"name_tr": string,"name_uk": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"id"?: string,"is_active"?: boolean,"is_system"?: boolean,"name_en"?: string,"name_tr"?: string,"name_uk"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"income_entries": {
                  Row: {
                    "amount": number,"category": string | null,"created_at": string,"description": string | null,"due_date": string | null,"id": string,"kind": string,"notes": string | null,"payment_date": string | null,"payment_method": string,"payment_status": string,"registration_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"id"?: string,"kind": string,"notes"?: string | null,"payment_date"?: string | null,"payment_method": string,"payment_status"?: string,"registration_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number,"category"?: string | null,"created_at"?: string,"description"?: string | null,"due_date"?: string | null,"id"?: string,"kind"?: string,"notes"?: string | null,"payment_date"?: string | null,"payment_method"?: string,"payment_status"?: string,"registration_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "income_entries_category_fkey"
      columns: ["category"]
isOneToOne: false
      referencedRelation: "income_categories"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "income_entries_registration_id_fkey"
      columns: ["registration_id"]
isOneToOne: false
      referencedRelation: "registrations"
      referencedColumns: ["id"]
    }
                  ]
                },"message_templates": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"is_default": boolean,"kind": string,"sort_order": number,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"kind": string,"sort_order"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"is_default"?: boolean,"kind"?: string,"sort_order"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"notes": {
                  Row: {
                    "color": string | null,"content": string | null,"created_at": string | null,"id": string,"is_favorite": boolean | null,"tags": (string)[] | null,"title": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"content"?: string | null,"created_at"?: string | null,"id"?: string,"is_favorite"?: boolean | null,"tags"?: (string)[] | null,"title": string,"updated_at"?: string | null
                  }
                  Update: {
                    "color"?: string | null,"content"?: string | null,"created_at"?: string | null,"id"?: string,"is_favorite"?: boolean | null,"tags"?: (string)[] | null,"title"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"package_types": {
                  Row: {
                    "code": string,"default_price": number | null,"family": string,"id": string,"is_active": boolean,"lessons": number | null,"name_en": string,"name_tr": string,"name_uk": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"default_price"?: number | null,"family": string,"id"?: string,"is_active"?: boolean,"lessons"?: number | null,"name_en": string,"name_tr": string,"name_uk": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "code"?: string,"default_price"?: number | null,"family"?: string,"id"?: string,"is_active"?: boolean,"lessons"?: number | null,"name_en"?: string,"name_tr"?: string,"name_uk"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recurring_expenses": {
                  Row: {
                    "amount": number | null,"created_at": string,"day_of_month": number,"expense_type": string,"id": string,"is_active": boolean,"notes": string | null,"payment_method": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount"?: number | null,"created_at"?: string,"day_of_month": number,"expense_type": string,"id"?: string,"is_active"?: boolean,"notes"?: string | null,"payment_method": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "amount"?: number | null,"created_at"?: string,"day_of_month"?: number,"expense_type"?: string,"id"?: string,"is_active"?: boolean,"notes"?: string | null,"payment_method"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurring_expenses_expense_type_fkey"
      columns: ["expense_type"]
isOneToOne: false
      referencedRelation: "expense_categories"
      referencedColumns: ["code"]
    }
                  ]
                },"reminder_log": {
                  Row: {
                    "id": string,"kind": string,"participant_id": string | null,"registration_id": string,"sent_at": string,"sent_by": string | null,"template_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"kind": string,"participant_id"?: string | null,"registration_id": string,"sent_at"?: string,"sent_by"?: string | null,"template_id"?: string | null
                  }
                  Update: {
                    "id"?: string,"kind"?: string,"participant_id"?: string | null,"registration_id"?: string,"sent_at"?: string,"sent_by"?: string | null,"template_id"?: string | null
                  }
                  Relationships: [

                  ]
                },"registrations": {
                  Row: {
                    "created_at": string | null,"extension_count": number | null,"extra_lessons": number,"id": string,"initial_end_date": string | null,"initial_notes": string | null,"initial_package_type": string | null,"initial_payment_amount": number | null,"initial_payment_method": string | null,"initial_start_date": string | null,"is_active": boolean | null,"last_extension_date": string | null,"notes": string | null,"package_end_date": string,"package_id": string | null,"package_start_date": string,"package_type": string,"parent_id": string | null,"parent_name": string,"parent_phone": string,"payment_amount": number,"payment_date": string | null,"payment_id": string | null,"payment_method": string,"payment_status": string,"registration_code": string | null,"student_age": string,"student_id": string | null,"student_name": string,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"extension_count"?: number | null,"extra_lessons"?: number,"id"?: string,"initial_end_date"?: string | null,"initial_notes"?: string | null,"initial_package_type"?: string | null,"initial_payment_amount"?: number | null,"initial_payment_method"?: string | null,"initial_start_date"?: string | null,"is_active"?: boolean | null,"last_extension_date"?: string | null,"notes"?: string | null,"package_end_date": string,"package_id"?: string | null,"package_start_date": string,"package_type": string,"parent_id"?: string | null,"parent_name": string,"parent_phone": string,"payment_amount": number,"payment_date"?: string | null,"payment_id"?: string | null,"payment_method": string,"payment_status": string,"registration_code"?: string | null,"student_age": string,"student_id"?: string | null,"student_name": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"extension_count"?: number | null,"extra_lessons"?: number,"id"?: string,"initial_end_date"?: string | null,"initial_notes"?: string | null,"initial_package_type"?: string | null,"initial_payment_amount"?: number | null,"initial_payment_method"?: string | null,"initial_start_date"?: string | null,"is_active"?: boolean | null,"last_extension_date"?: string | null,"notes"?: string | null,"package_end_date"?: string,"package_id"?: string | null,"package_start_date"?: string,"package_type"?: string,"parent_id"?: string | null,"parent_name"?: string,"parent_phone"?: string,"payment_amount"?: number,"payment_date"?: string | null,"payment_id"?: string | null,"payment_method"?: string,"payment_status"?: string,"registration_code"?: string | null,"student_age"?: string,"student_id"?: string | null,"student_name"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"waitlist": {
                  Row: {
                    "contact_date": string,"created_at": string,"id": string,"notes": string | null,"package_type": string,"parent_name": string,"parent_phone": string,"status": string,"student_age": string,"student_name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_date"?: string,"created_at"?: string,"id"?: string,"notes"?: string | null,"package_type": string,"parent_name": string,"parent_phone": string,"status"?: string,"student_age": string,"student_name": string,"updated_at"?: string
                  }
                  Update: {
                    "contact_date"?: string,"created_at"?: string,"id"?: string,"notes"?: string | null,"package_type"?: string,"parent_name"?: string,"parent_phone"?: string,"status"?: string,"student_age"?: string,"student_name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"weekly_themes": {
                  Row: {
                    "created_at": string | null,"id": string,"theme": string,"updated_at": string | null,"week_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"theme": string,"updated_at"?: string | null,"week_start": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"theme"?: string,"updated_at"?: string | null,"week_start"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "assert_admin":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"copy_week":
{ Args: { "p_dry_run"?: boolean,"p_excluded"?: (string)[],"p_source_start": string,"p_weeks": number }; Returns: Json
                           },
"create_registration":
{ Args: { "p_data": Json }; Returns: {
              "created_at": string | null,
"extension_count": number | null,
"extra_lessons": number,
"id": string,
"initial_end_date": string | null,
"initial_notes": string | null,
"initial_package_type": string | null,
"initial_payment_amount": number | null,
"initial_payment_method": string | null,
"initial_start_date": string | null,
"is_active": boolean | null,
"last_extension_date": string | null,
"notes": string | null,
"package_end_date": string,
"package_id": string | null,
"package_start_date": string,
"package_type": string,
"parent_id": string | null,
"parent_name": string,
"parent_phone": string,
"payment_amount": number,
"payment_date": string | null,
"payment_id": string | null,
"payment_method": string,
"payment_status": string,
"registration_code": string | null,
"student_age": string,
"student_id": string | null,
"student_name": string,
"updated_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "registrations"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_last_extension":
{ Args: { "p_extension_id": string }; Returns: undefined
                           },
"extend_registration":
{ Args: { "p_expected_extension_count": number,"p_extra_lessons"?: number,"p_new_end_date": string,"p_new_package_type": string,"p_new_start_date": string,"p_notes": string,"p_payment_amount": number,"p_payment_date": string,"p_payment_method": string,"p_payment_status": string,"p_previous_carried_lessons": number,"p_registration_id": string }; Returns: string
                           },
"grant_admin":
{ Args: { "p_email": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_admins":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"email": string,"is_self": boolean,"user_id": string
            }[]
                           },
"set_default_message_template":
{ Args: { "template_id": string }; Returns: undefined
                           },
"revoke_admin":
{ Args: { "p_user_id": string }; Returns: undefined
                           },
"update_extension":
{ Args: { "p_expected_updated_at": string,"p_extension_id": string,"p_new_end_date": string,"p_new_package_type": string,"p_new_start_date": string,"p_notes": string,"p_payment_amount": number,"p_payment_date": string,"p_payment_method": string,"p_payment_status": string }; Returns: undefined
                           },
"update_registration":
{ Args: { "p_changes": Json,"p_expected_updated_at": string,"p_registration_id": string }; Returns: {
              "created_at": string | null,
"extension_count": number | null,
"extra_lessons": number,
"id": string,
"initial_end_date": string | null,
"initial_notes": string | null,
"initial_package_type": string | null,
"initial_payment_amount": number | null,
"initial_payment_method": string | null,
"initial_start_date": string | null,
"is_active": boolean | null,
"last_extension_date": string | null,
"notes": string | null,
"package_end_date": string,
"package_id": string | null,
"package_start_date": string,
"package_type": string,
"parent_id": string | null,
"parent_name": string,
"parent_phone": string,
"payment_amount": number,
"payment_date": string | null,
"payment_id": string | null,
"payment_method": string,
"payment_status": string,
"registration_code": string | null,
"student_age": string,
"student_id": string | null,
"student_name": string,
"updated_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "registrations"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
