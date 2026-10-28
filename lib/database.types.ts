
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
                },"album_claims": {
                  Row: {
                    "claimed_at": string,"pct": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed_at"?: string,"pct": number,"user_id": string
                  }
                  Update: {
                    "claimed_at"?: string,"pct"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "album_claims_pct_fkey"
      columns: ["pct"]
isOneToOne: false
      referencedRelation: "album_rewards"
      referencedColumns: ["pct"]
    }
                  ]
                },"album_rewards": {
                  Row: {
                    "cosmetic": string | null,"ep": number,"label": string,"pct": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cosmetic"?: string | null,"ep"?: number,"label": string,"pct": number
                  }
                  Update: {
                    "cosmetic"?: string | null,"ep"?: number,"label"?: string,"pct"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "album_rewards_cosmetic_fkey"
      columns: ["cosmetic"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    }
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
                },"community_numbers": {
                  Row: {
                    "day": string,"number": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"number": number
                  }
                  Update: {
                    "day"?: string,"number"?: number
                  }
                  Relationships: [
                    
                  ]
                },"community_results": {
                  Row: {
                    "day": string,"distance": number,"matches": number,"number": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"distance": number,"matches": number,"number": number,"user_id": string
                  }
                  Update: {
                    "day"?: string,"distance"?: number,"matches"?: number,"number"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cosmetics": {
                  Row: {
                    "description": string,"id": string,"kind": string,"name": string,"price": number | null,"sort": number,"unlock": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"id": string,"kind": string,"name": string,"price"?: number | null,"sort"?: number,"unlock"?: string | null
                  }
                  Update: {
                    "description"?: string,"id"?: string,"kind"?: string,"name"?: string,"price"?: number | null,"sort"?: number,"unlock"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ep_credits": {
                  Row: {
                    "amount": number,"created_at": string,"id": number,"kind": string,"ref": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: never,"kind": string,"ref": string,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: never,"kind"?: string,"ref"?: string,"user_id"?: string
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
                },"event_days": {
                  Row: {
                    "day": string,"event_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"event_id": number
                  }
                  Update: {
                    "day"?: string,"event_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_days_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "game_events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_hits": {
                  Row: {
                    "day": string,"event_id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"event_id": number,"user_id": string
                  }
                  Update: {
                    "day"?: string,"event_id"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_hits_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "game_events"
      referencedColumns: ["id"]
    }
                  ]
                },"family_fusions": {
                  Row: {
                    "family": string,"fused_at": string,"reward_ep": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "family": string,"fused_at"?: string,"reward_ep": number,"user_id": string
                  }
                  Update: {
                    "family"?: string,"fused_at"?: string,"reward_ep"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"game_events": {
                  Row: {
                    "badge_slugs": (string)[],"color": string,"id": number,"multiplier": number,"name": string,"reward_cosmetic": string | null,"reward_hits": number,"roll_label": string,"slug": string,"tagline": string
                  }
                  ComputedFields: never
                  Insert: {
                    "badge_slugs": (string)[],"color": string,"id": number,"multiplier"?: number,"name": string,"reward_cosmetic"?: string | null,"reward_hits"?: number,"roll_label": string,"slug": string,"tagline": string
                  }
                  Update: {
                    "badge_slugs"?: (string)[],"color"?: string,"id"?: number,"multiplier"?: number,"name"?: string,"reward_cosmetic"?: string | null,"reward_hits"?: number,"roll_label"?: string,"slug"?: string,"tagline"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_events_reward_cosmetic_fkey"
      columns: ["reward_cosmetic"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    }
                  ]
                },"hunt_days": {
                  Row: {
                    "badge_id": number,"bonus_ep": number,"counted": number,"day": string
                  }
                  ComputedFields: never
                  Insert: {
                    "badge_id": number,"bonus_ep": number,"counted": number,"day": string
                  }
                  Update: {
                    "badge_id"?: number,"bonus_ep"?: number,"counted"?: number,"day"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hunt_days_badge_id_fkey"
      columns: ["badge_id"]
isOneToOne: false
      referencedRelation: "badges"
      referencedColumns: ["id"]
    }
                  ]
                },"hunt_hits": {
                  Row: {
                    "bonus_ep": number,"day": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bonus_ep": number,"day": string,"user_id": string
                  }
                  Update: {
                    "bonus_ep"?: number,"day"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"hunt_progress": {
                  Row: {
                    "total_wins": number,"user_id": string,"wins": number
                  }
                  ComputedFields: never
                  Insert: {
                    "total_wins"?: number,"user_id": string,"wins"?: number
                  }
                  Update: {
                    "total_wins"?: number,"user_id"?: string,"wins"?: number
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
                },"player_cosmetics": {
                  Row: {
                    "acquired_at": string,"item_id": string,"source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "acquired_at"?: string,"item_id": string,"source": string,"user_id": string
                  }
                  Update: {
                    "acquired_at"?: string,"item_id"?: string,"source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_cosmetics_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "aura": string | null,"avatar_locked": boolean,"avatar_path": string | null,"created_at": string,"display_name": string,"frame": string | null,"id": string,"name_style": string | null,"reveal": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aura"?: string | null,"avatar_locked"?: boolean,"avatar_path"?: string | null,"created_at"?: string,"display_name": string,"frame"?: string | null,"id": string,"name_style"?: string | null,"reveal"?: string | null
                  }
                  Update: {
                    "aura"?: string | null,"avatar_locked"?: boolean,"avatar_path"?: string | null,"created_at"?: string,"display_name"?: string,"frame"?: string | null,"id"?: string,"name_style"?: string | null,"reveal"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_aura_fkey"
      columns: ["aura"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_frame_fkey"
      columns: ["frame"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_name_style_fkey"
      columns: ["name_style"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_reveal_fkey"
      columns: ["reveal"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    }
                  ]
                },"reminder_prefs": {
                  Row: {
                    "enabled": boolean,"last_sent": string | null,"token": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"last_sent"?: string | null,"token"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "enabled"?: boolean,"last_sent"?: string | null,"token"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reroll_tokens": {
                  Row: {
                    "count": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "count"?: number,"user_id": string
                  }
                  Update: {
                    "count"?: number,"user_id"?: string
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
                    "attempt": number,"base_ep": number,"bonus_ep": number,"created_at": string,"ep": number,"event_bonus_ep": number,"free_reroll": boolean,"id": number,"multiplier": number,"number": number,"roll_date": string,"tier": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt"?: number,"base_ep": number,"bonus_ep"?: number,"created_at"?: string,"ep": number,"event_bonus_ep"?: number,"free_reroll"?: boolean,"id"?: never,"multiplier"?: number,"number": number,"roll_date"?: string,"tier": string,"user_id": string
                  }
                  Update: {
                    "attempt"?: number,"base_ep"?: number,"bonus_ep"?: number,"created_at"?: string,"ep"?: number,"event_bonus_ep"?: number,"free_reroll"?: boolean,"id"?: never,"multiplier"?: number,"number"?: number,"roll_date"?: string,"tier"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"shield_uses": {
                  Row: {
                    "day": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"user_id": string
                  }
                  Update: {
                    "day"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"streak_milestone_defs": {
                  Row: {
                    "cosmetic": string | null,"days": number,"ep": number,"shields": number
                  }
                  ComputedFields: never
                  Insert: {
                    "cosmetic"?: string | null,"days": number,"ep"?: number,"shields"?: number
                  }
                  Update: {
                    "cosmetic"?: string | null,"days"?: number,"ep"?: number,"shields"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "streak_milestone_defs_cosmetic_fkey"
      columns: ["cosmetic"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    }
                  ]
                },"streak_milestones": {
                  Row: {
                    "claimed_at": string,"days": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed_at"?: string,"days": number,"user_id": string
                  }
                  Update: {
                    "claimed_at"?: string,"days"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "streak_milestones_days_fkey"
      columns: ["days"]
isOneToOne: false
      referencedRelation: "streak_milestone_defs"
      referencedColumns: ["days"]
    }
                  ]
                },"streak_shields": {
                  Row: {
                    "auto_use": boolean,"count": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_use"?: boolean,"count"?: number,"user_id": string
                  }
                  Update: {
                    "auto_use"?: boolean,"count"?: number,"user_id"?: string
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
                    "aura": string | null,"avatar_path": string | null,"best_ep": number | null,"display_name": string | null,"frame": string | null,"name_style": string | null,"rank": number | null,"roll_count": number | null,"total_ep": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "profiles_aura_fkey"
      columns: ["aura"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_frame_fkey"
      columns: ["frame"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_name_style_fkey"
      columns: ["name_style"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    }
                  ]
                },"leaderboard_today": {
                  Row: {
                    "aura": string | null,"avatar_path": string | null,"bonus_ep": number | null,"display_name": string | null,"ep": number | null,"frame": string | null,"multiplier": number | null,"name_style": string | null,"number": number | null,"rank": number | null,"tier": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "profiles_aura_fkey"
      columns: ["aura"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_frame_fkey"
      columns: ["frame"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_name_style_fkey"
      columns: ["name_style"]
isOneToOne: false
      referencedRelation: "cosmetics"
      referencedColumns: ["id"]
    }
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
"buy_cosmetic":
{ Args: { "item": string }; Returns: Json
                           },
"buy_shield":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"community_today":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"equip_cosmetic":
{ Args: { "item": string,"slot": string }; Returns: undefined
                           },
"event_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"fuse_family":
{ Args: { "fam": string }; Returns: Json
                           },
"hunt_today":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_streak":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"player_stats":
{ Args: { "target_name": string }; Returns: Json
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
"set_shield_auto":
{ Args: { "on_off": boolean }; Returns: undefined
                           },
"spin_wheel":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"unsubscribe_reminders":
{ Args: { "unsubscribe_token": string }; Returns: boolean
                           },
"weekly_recap":
{ Args: { "week_back"?: number }; Returns: Json
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
