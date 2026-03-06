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

  private getClient(): SupabaseClient | null {
    if (this.supabase) return this.supabase;

    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (SUPABASE_URL && SUPABASE_KEY) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("Connected to Supabase");
      return this.supabase;
    } else {
      console.warn("Supabase credentials missing. Database will not work.");
      return null;
    }
  }

  async getScenarios(): Promise<Scenario[]> {
    const client = this.getClient();
    if (!client) return [];
    
    const { data, error } = await client
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
    const client = this.getClient();
    if (!client) return null;

    const { data, error } = await client
      .from('scenarios')
      .select('*')
      .eq('korean', korean)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async getScenarioById(id: string | number): Promise<Scenario | null> {
    const client = this.getClient();
    if (!client) return null;

    const { data, error } = await client
      .from('scenarios')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async addScenario(scenario: Scenario): Promise<{ success: boolean; id?: number; message?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, message: "Database not connected" };
    
    const existing = await this.getScenarioByKorean(scenario.korean);
    if (existing) {
      return { success: true, id: existing.id, message: "Already exists" };
    }

    const { data, error } = await client
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
    const client = this.getClient();
    if (!client) return;

    try {
      const { count, error: countError } = await client
        .from('scenarios')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        // If table doesn't exist, this will error. We should log it clearly.
        console.error("Supabase 'scenarios' table might not exist or is inaccessible:", countError.message);
        return;
      }

      if (count === 0) {
        console.log("Seeding Supabase with initial data...");
        const { error: insertError } = await client
          .from('scenarios')
          .insert(data.map(d => ({
            korean: d.korean,
            japanese: d.japanese,
            tokens: d.tokens,
            level: d.level,
            category: d.category
          })));
        
        if (insertError) console.error("Error seeding Supabase:", insertError.message);
        else console.log("Supabase seeded successfully!");
      }
    } catch (e) {
      console.error("Unexpected error during seeding:", e);
    }
  }
}

export const dbService = new DatabaseService();
