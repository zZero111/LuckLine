
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"badges": {
                  Row: {
                    "description": string,"emoji": string,"ep": number,"family": string,"id": number,"name": string,"probability": number,"rarity": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"emoji": string,"ep": number,"family"?: string,"id": number,"name": string,"probability": number,"rarity": string,"slug": string
                  }
                  Update: {
                    "description"?: string,"emoji"?: string,"ep"?: number,"family"?: string,"id"?: number,"name"?: string,"probability"?: number,"rarity"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ep_wallets": {
                  Row: {
                    "balance": number | null,"earned_ep": number,"spent_ep": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "balance"?: never,"earned_ep"?: number,"spent_ep"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "balance"?: never,"earned_ep"?: number,"spent_ep"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"leaderboard_totals": {
                  Row: {
                    "best_ep": number,"roll_count": number,"total_ep": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "best_ep"?: number,"roll_count"?: number,"total_ep"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "best_ep"?: number,"roll_count"?: number,"total_ep"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"number_stats": {
                  Row: {
                    "badge_ids": (number)[],"ep": number,"number": number,"tier": string
                  }
                  ComputedFields: never
                  Insert: {
                    "badge_ids"?: (number)[],"ep": number,"number": number,"tier": string
                  }
                  Update: {
                    "badge_ids"?: (number)[],"ep"?: number,"number"?: number,"tier"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_locked": boolean,"avatar_path": string | null,"created_at": string,"display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_locked"?: boolean,"avatar_path"?: string | null,"created_at"?: string,"display_name": string,"id": string
                  }
                  Update: {
                    "avatar_locked"?: boolean,"avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"roll_badges": {
                  Row: {
                    "badge_id": number,"roll_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "badge_id": number,"roll_id": number
                  }
                  Update: {
                    "badge_id"?: number,"roll_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "roll_badges_badge_id_fkey"
      columns: ["badge_id"]
isOneToOne: false
      referencedRelation: "badges"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roll_badges_roll_id_fkey"
      columns: ["roll_id"]
isOneToOne: false
      referencedRelation: "rolls"
      referencedColumns: ["id"]
    }
                  ]
                },"rolls": {
                  Row: {
                    "attempt": number,"base_ep": number,"bonus_ep": number,"created_at": string,"ep": number,"id": number,"multiplier": number,"number": number,"roll_date": string,"tier": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt"?: number,"base_ep": number,"bonus_ep"?: number,"created_at"?: string,"ep": number,"id"?: never,"multiplier"?: number,"number": number,"roll_date"?: string,"tier": string,"user_id": string
                  }
                  Update: {
                    "attempt"?: number,"base_ep"?: number,"bonus_ep"?: number,"created_at"?: string,"ep"?: number,"id"?: never,"multiplier"?: number,"number"?: number,"roll_date"?: string,"tier"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"wheel_prizes": {
                  Row: {
                    "color": string,"id": number,"kind": string,"label": string,"slug": string,"sort": number,"value": number,"weight": number
                  }
                  ComputedFields: never
                  Insert: {
                    "color": string,"id": number,"kind": string,"label": string,"slug": string,"sort": number,"value"?: number,"weight": number
                  }
                  Update: {
                    "color"?: string,"id"?: number,"kind"?: string,"label"?: string,"slug"?: string,"sort"?: number,"value"?: number,"weight"?: number
                  }
                  Relationships: [
                    
                  ]
                },"wheel_spins": {
                  Row: {
                    "created_at": string,"ep_after": number,"ep_before": number,"free_reroll_used": boolean,"prize_id": number,"roll_id": number,"spin_date": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ep_after": number,"ep_before": number,"free_reroll_used"?: boolean,"prize_id": number,"roll_id": number,"spin_date": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"ep_after"?: number,"ep_before"?: number,"free_reroll_used"?: boolean,"prize_id"?: number,"roll_id"?: number,"spin_date"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wheel_spins_prize_id_fkey"
      columns: ["prize_id"]
isOneToOne: false
      referencedRelation: "wheel_prizes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wheel_spins_roll_id_fkey"
      columns: ["roll_id"]
isOneToOne: false
      referencedRelation: "rolls"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "leaderboard_all_time": {
                  Row: {
                    "avatar_path": string | null,"best_ep": number | null,"display_name": string | null,"rank": number | null,"roll_count": number | null,"total_ep": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"leaderboard_today": {
                  Row: {
                    "avatar_path": string | null,"bonus_ep": number | null,"display_name": string | null,"ep": number | null,"multiplier": number | null,"number": number | null,"rank": number | null,"tier": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "admin_remove_avatar":
{ Args: { "target_name": string }; Returns: string
                           },
"am_i_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"reroll_terms":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"reroll_today":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"roll_today":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"spin_wheel":
{ Args: Record<PropertyKey, never>; Returns: Json
                           }
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
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
