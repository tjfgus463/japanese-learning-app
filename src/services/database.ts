import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export interface Scenario {
  id?: number;
  korean: string;
  japanese: string;
  tokens: any;
  level: number;
  category: string;
}

class DatabaseService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    if (SUPABASE_URL && SUPABASE_KEY) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("Connected to Supabase");
    } else {
      console.warn("Supabase credentials missing. Database will not work.");
    }
  }

  async getScenarios(): Promise<Scenario[]> {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('scenarios')
      .select('*')
      .order('id', { ascending: true });
    if (error) {
      console.error("Error fetching scenarios:", error);
      return [];
    }
    return data || [];
  }

  async getScenarioByKorean(korean: string): Promise<Scenario | null> {
    if (!this.supabase) return null;
    const { data, error } = await this.supabase
      .from('scenarios')
      .select('*')
      .eq('korean', korean)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getScenarioById(id: string | number): Promise<Scenario | null> {
    if (!this.supabase) return null;
    const { data, error } = await this.supabase
      .from('scenarios')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async addScenario(scenario: Scenario): Promise<{ success: boolean; id?: number; message?: string }> {
    if (!this.supabase) return { success: false, message: "Database not connected" };
    
    const existing = await this.getScenarioByKorean(scenario.korean);
    if (existing) {
      return { success: true, id: existing.id, message: "Already exists" };
    }

    const { data, error } = await this.supabase
      .from('scenarios')
      .insert([{
        korean: scenario.korean,
        japanese: scenario.japanese,
        tokens: scenario.tokens,
        level: scenario.level,
        category: scenario.category
      }])
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, id: data.id };
  }

  async seed(data: Scenario[]) {
    if (!this.supabase) return;

    const { count, error: countError } = await this.supabase
      .from('scenarios')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error("Error checking Supabase count:", countError);
      return;
    }

    if (count === 0) {
      console.log("Seeding Supabase with initial data...");
      const { error: insertError } = await this.supabase
        .from('scenarios')
        .insert(data.map(d => ({
          korean: d.korean,
          japanese: d.japanese,
          tokens: d.tokens,
          level: d.level,
          category: d.category
        })));
      
      if (insertError) console.error("Error seeding Supabase:", insertError);
      else console.log("Supabase seeded successfully!");
    }
  }
}

export const dbService = new DatabaseService();
